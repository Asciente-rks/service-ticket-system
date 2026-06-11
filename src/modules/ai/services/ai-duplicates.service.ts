import { Op } from 'sequelize';
import { Ticket } from '../../tickets/models/ticket.model';
import { TicketStatus } from '../../tickets/models/ticket-status.model';
import { Collection } from '../../collections/models/collection.model';
import { STATUSES } from '../../../config/statuses';
import { chatCompletion } from './ai-provider.service';
import type { TicketRef } from './ai-tools.service';

/**
 * AI-powered duplicate ticket detection. Sends the unresolved tickets of a
 * collection (title + description) to the LLM and asks for conservative
 * duplicate groups — catching "same issue, different wording" cases plain
 * string matching would miss.
 *
 * Results are cached per org+collection for a few minutes (free-tier quota
 * protection); on cache hits the grouped tickets are re-verified against the
 * live DB so deleted/resolved tickets disappear from the banner immediately.
 */

export interface DuplicateGroup {
  reason: string;
  confidence?: 'high' | 'medium';
  tickets: TicketRef[];
}

interface CacheEntry {
  at: number;
  groups: DuplicateGroup[];
}

const CACHE_TTL_MS = 10 * 60_000;
const MAX_TICKETS_ANALYZED = 60;

const cache: Map<string, CacheEntry> = new Map();

const RESOLVED_STATUS_IDS = [STATUSES.RESOLVED, STATUSES.CLOSED];

const ticketIncludes = [{ model: TicketStatus, as: 'status', attributes: ['id', 'name'] }];

const toRef = (t: any): TicketRef => ({
  id: t.id,
  title: t.title,
  status: t.status?.name,
  priority: t.priority || undefined,
  collectionId: t.collectionId ?? null,
});

/** Re-check a cached result against live data: drop deleted/resolved tickets. */
const reverifyGroups = async (groups: DuplicateGroup[]): Promise<DuplicateGroup[]> => {
  const ids = groups.flatMap((g) => g.tickets.map((t) => t.id));
  if (ids.length === 0) return [];
  const alive: any[] = await Ticket.findAll({
    where: { id: { [Op.in]: ids }, statusId: { [Op.notIn]: RESOLVED_STATUS_IDS } },
    include: ticketIncludes,
    attributes: ['id', 'title', 'priority', 'statusId', 'collectionId'],
  });
  const aliveMap = new Map(alive.map((t) => [String(t.id), t]));
  return groups
    .map((g) => ({
      reason: g.reason,
      confidence: g.confidence,
      tickets: g.tickets.filter((t) => aliveMap.has(String(t.id))).map((t) => toRef(aliveMap.get(String(t.id)))),
    }))
    .filter((g) => g.tickets.length >= 2);
};

const parseModelJson = (raw: string): { groups?: { reason?: string; confidence?: string; ticketIds?: string[] }[] } | null => {
  let text = (raw || '').trim();
  // Strip markdown fences if the model added them despite instructions.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Grab the outermost JSON object if there's stray prose around it.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

export const detectDuplicates = async (
  organizationId: string,
  collectionId?: string | null,
): Promise<{ groups: DuplicateGroup[]; checkedAt: string; analyzedCount: number }> => {
  const key = `v2:${organizationId}:${collectionId || 'all'}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const groups = await reverifyGroups(cached.groups);
    return { groups, checkedAt: new Date(cached.at).toISOString(), analyzedCount: -1 };
  }

  const where: any = {
    organizationId,
    statusId: { [Op.notIn]: RESOLVED_STATUS_IDS },
  };
  if (collectionId) where.collectionId = collectionId;

  const tickets: any[] = await Ticket.findAll({
    where,
    include: ticketIncludes,
    order: [['createdAt', 'DESC']],
    limit: MAX_TICKETS_ANALYZED,
  });

  if (tickets.length < 2) {
    cache.set(key, { at: Date.now(), groups: [] });
    return { groups: [], checkedAt: new Date().toISOString(), analyzedCount: tickets.length };
  }

  const compact = tickets.map((t) => ({
    id: t.id,
    title: String(t.title || '').slice(0, 160),
    description: String(t.description || '').slice(0, 350),
  }));

  const prompt = `You are a senior QA triage engineer deduplicating a bug/issue tracker.

Two tickets are DUPLICATES when they report the same underlying problem or request about the same feature/component — even if one is terse and the other detailed, the wording differs completely, or they are written in different languages. Titles are often vague (e.g. "AI" vs "Feature: AI Assistant" — both about the AI assistant); rely on titles AND descriptions together.

Method — for EACH ticket, first infer:
(a) the feature/component involved (e.g. "AI assistant", "login", "billing export")
(b) the symptom or request (e.g. "answers are too generic", "crashes on submit")
Then group tickets whose component AND symptom clearly overlap.

Confidence:
- "high" — clearly the same issue.
- "medium" — likely the same issue / heavily overlapping reports that a human should review side by side. INCLUDE these too; the UI labels them as potential duplicates.
Never group tickets about clearly different features. A group needs at least 2 tickets; a ticket appears in at most one group. "reason" is one short sentence naming the shared component + symptom.

Respond with STRICT JSON only (no prose, no markdown fences):
{"groups":[{"reason":"...","confidence":"high","ticketIds":["<id>","<id>"]}]}
If there are no duplicates: {"groups":[]}

TICKETS:
${JSON.stringify(compact)}`;

  const result = await chatCompletion(
    [{ role: 'user', content: prompt }],
    undefined,
    800,
    true, // JSON mode
  );

  const parsed = parseModelJson(result.content || '');
  const ticketMap = new Map(tickets.map((t) => [String(t.id), t]));

  const groups: DuplicateGroup[] = [];
  if (parsed && Array.isArray(parsed.groups)) {
    const seen = new Set<string>();
    for (const g of parsed.groups) {
      if (!g || !Array.isArray(g.ticketIds)) continue;
      const refs: TicketRef[] = [];
      for (const id of g.ticketIds) {
        const t = ticketMap.get(String(id));
        if (t && !seen.has(String(id))) {
          seen.add(String(id));
          refs.push(toRef(t));
        }
      }
      if (refs.length >= 2) {
        groups.push({
          reason: String(g.reason || 'These tickets appear to describe the same issue.').slice(0, 300),
          confidence: g.confidence === 'medium' ? 'medium' : 'high',
          tickets: refs,
        });
      }
    }
  }

  cache.set(key, { at: Date.now(), groups });
  return { groups, checkedAt: new Date().toISOString(), analyzedCount: tickets.length };
};

/** Drop the cache for an org (e.g. could be called after bulk changes). */
export const invalidateDuplicateCache = (organizationId: string) => {
  for (const key of cache.keys()) {
    if (key.includes(`:${organizationId}:`)) cache.delete(key);
  }
};
