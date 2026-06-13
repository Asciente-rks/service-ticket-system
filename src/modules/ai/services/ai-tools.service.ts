import { Op } from 'sequelize';
import { Ticket } from '../../tickets/models/ticket.model';
import { TicketStatus } from '../../tickets/models/ticket-status.model';
import { User } from '../../users/models/user.model';
import { Comment } from '../../tickets/models/comment.model';
import { TicketEvent } from '../../tickets/models/ticket-event.model';
import { Approval } from '../../tickets/models/approval.model';
import { Collection } from '../../collections/models/collection.model';
import { PlatformVersion } from '../../collections/models/platform-version.model';
import { findTicketIdsAssignedToUser } from '../../tickets/repositories/ticket.repository';
import { ToolDefinition } from './ai-provider.service';
import { formatPhDateTime } from './ph-time.util';
import { detectDuplicates, DuplicateGroup } from './ai-duplicates.service';

/**
 * Models sometimes pass booleans as strings ("true"/"false") — a naive
 * truthiness check turns "false" into an active filter and silently wrecks
 * counts. Only an explicit true counts as true.
 */
const asBool = (v: any): boolean => v === true || v === 'true' || v === 1;

/**
 * Function-calling tools the AI assistant can use. Every query is scoped to
 * the caller's organization (tenant isolation) and receives the caller's user
 * id so "my tickets" style questions resolve correctly.
 */

export interface TicketRef {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  collectionId?: string | null;
}

export interface ToolContext {
  organizationId: string;
  userId: string;
}

const ticketInclude = [
  { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'assignees', attributes: ['id', 'name', 'email'], through: { attributes: [] } },
  { model: TicketStatus, as: 'status', attributes: ['id', 'name'] },
  { model: Collection, as: 'collection', attributes: ['id', 'name'] },
  { model: PlatformVersion, as: 'platformVersion', attributes: ['id', 'platform', 'version'] },
  { model: PlatformVersion, as: 'platformVersions', attributes: ['id', 'platform', 'version'], through: { attributes: [] } },
];

const assigneeNames = (t: any): string[] =>
  Array.isArray(t.assignees) && t.assignees.length
    ? t.assignees.map((u: any) => u.name).filter(Boolean)
    : t.assignee?.name
      ? [t.assignee.name]
      : [];

const platformVersionLabel = (t: any): string | null => {
  const list = Array.isArray(t.platformVersions) && t.platformVersions.length
    ? t.platformVersions
    : t.platformVersion
      ? [t.platformVersion]
      : [];
  if (!list.length) return null;
  return list.map((p: any) => `${p.platform} · ${p.version}`).join(', ');
};

const toSummary = (t: any) => {
  const names = assigneeNames(t);
  return {
    id: t.id,
    title: t.title,
    status: t.status?.name || 'Unknown',
    priority: t.priority || 'None',
    collection: t.collection?.name || null,
    platformVersion: platformVersionLabel(t),
    reporter: t.reporter?.name || 'Unknown',
    // Primary assignee plus the full roster (a ticket can have several).
    assignee: names[0] || 'Unassigned',
    assignees: names.length ? names : ['Unassigned'],
    descriptionPreview: t.description ? String(t.description).slice(0, 200) : null,
    createdAt: formatPhDateTime(t.createdAt),
    updatedAt: formatPhDateTime(t.updatedAt),
  };
};

const toTicketRef = (t: any) => ({
  id: t.id,
  title: t.title,
  status: t.status?.name,
  priority: t.priority || undefined,
  collectionId: t.collectionId ?? t.collection?.id ?? null,
});

export const toolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'query_tickets',
      description:
        "Search and list tickets in the user's organization. Use for questions like 'how many tickets are assigned to me', 'show open high priority tickets', 'tickets reported by me', 'find tickets about login'. Returns matching tickets — 'assignee' is the PRIMARY/current owner and 'assignees' is the full set (a ticket may have several). assignedToMe matches tickets where the user is ANY assignee. 'platformVersion' is the build it was reported on, if set. IMPORTANT: use the FEWEST filters that answer the question; for 'how many are assigned to me' pass ONLY assignedToMe=true. Never combine assignedToMe and reportedByMe unless the user explicitly asks for tickets that are both.",
      parameters: {
        type: 'object',
        properties: {
          assignedToMe: {
            type: 'boolean',
            description: 'Only tickets whose CURRENT assignee is the current user. Omit entirely when not needed (never pass false).',
          },
          reportedByMe: {
            type: 'boolean',
            description: 'Only tickets reported/created by the current user. Omit entirely when not needed (never pass false).',
          },
          status: {
            type: 'string',
            description:
              "Filter by status name. One of: Open, In Progress, Ready for QA, Error Persists, Resolved, Closed.",
          },
          priority: {
            type: 'string',
            description: 'Filter by priority: Low, Medium or High.',
          },
          search: {
            type: 'string',
            description: 'Free-text search across ticket title and description.',
          },
          collection: {
            type: 'string',
            description: 'Filter by collection (system/product) name, e.g. "Mobile App".',
          },
          limit: {
            type: 'number',
            description: 'Max tickets to return (default 20, max 50).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_comments',
      description:
        "Search comments ACROSS ALL tickets in the organization. Use for questions like 'did I leave any comments?', 'what did Ana say recently?', 'latest discussions', or counting someone's comments. Returns each comment with its ticket.",
      parameters: {
        type: 'object',
        properties: {
          authoredByMe: {
            type: 'boolean',
            description: 'Only comments written by the current user.',
          },
          authorName: {
            type: 'string',
            description: 'Only comments by a member with this name (partial match).',
          },
          ticketId: { type: 'string', description: 'Limit to one ticket (UUID).' },
          search: { type: 'string', description: 'Free-text search inside comment bodies.' },
          limit: { type: 'number', description: 'Max comments to return (default 15, max 30).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_activity',
      description:
        "Search the activity timeline (status changes, assignments, approvals, reports) ACROSS ALL tickets. Use for 'what happened today/this week', 'who changed statuses recently', 'what did I do recently'. Returns events newest-first with their ticket.",
      parameters: {
        type: 'object',
        properties: {
          byMe: { type: 'boolean', description: 'Only actions performed by the current user.' },
          actorName: { type: 'string', description: 'Only actions by a member with this name.' },
          type: {
            type: 'string',
            description: 'Filter by event type: reported, assigned, reassigned, status_changed, approved, rejected.',
          },
          ticketId: { type: 'string', description: 'Limit to one ticket (UUID).' },
          limit: { type: 'number', description: 'Max events to return (default 20, max 40).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_duplicate_tickets',
      description:
        'Run AI duplicate detection over unresolved tickets — finds tickets reporting the SAME underlying issue even when worded differently. Use when the user asks to review/verify duplicate tickets. Optionally scoped to one collection by name. The app renders interactive review controls (open/delete/keep) under your reply automatically.',
      parameters: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Collection (system/product) name to scan, e.g. "Mobile App". Omit to scan all collections.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_collections',
      description:
        "List the organization's collections (the systems/products tickets are grouped into) with ticket counts. Use when the user asks about collections, systems, projects, or where tickets live.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ticket_details',
      description:
        'Fetch full details of one ticket by its id: description, status, priority, reporter, assignee, recent comments and activity timeline. Use when the user asks about a specific ticket.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: { type: 'string', description: 'The ticket UUID.' },
        },
        required: ['ticketId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ticket_stats',
      description:
        "Aggregate ticket counts for the user's organization grouped by status and priority, plus counts assigned to / reported by the current user. Use for overview questions like 'give me a summary of the workload' or 'how busy is the team'.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_team_members',
      description:
        "List members of the user's organization (id, name, email) so ticket assignees and reporters can be matched by name.",
      parameters: { type: 'object', properties: {} },
    },
  },
];

const queryTickets = async (ctx: ToolContext, args: any) => {
  const where: any = { organizationId: ctx.organizationId };
  const appliedFilters: string[] = [];
  // OR-groups are collected here and ANDed together, so multiple OR-based
  // filters (assignedToMe membership + free-text search) can't clobber each other.
  const andConditions: any[] = [];

  if (asBool(args?.assignedToMe)) {
    // "Assigned to me" = the primary owner OR any member of the assignee set.
    const assignedIds = await findTicketIdsAssignedToUser(ctx.organizationId, ctx.userId);
    andConditions.push({
      [Op.or]: [
        { assignedTo: ctx.userId },
        ...(assignedIds.length ? [{ id: { [Op.in]: assignedIds } }] : []),
      ],
    });
    appliedFilters.push('assignedToMe');
  }
  if (asBool(args?.reportedByMe)) { where.reportedBy = ctx.userId; appliedFilters.push('reportedByMe'); }

  if (args?.priority && typeof args.priority === 'string') {
    const p = args.priority.trim().toLowerCase();
    const valid: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };
    if (valid[p]) { where.priority = valid[p]; appliedFilters.push(`priority=${valid[p]}`); }
  }

  if (args?.search && typeof args.search === 'string' && args.search.trim()) {
    const q = `%${args.search.trim()}%`;
    andConditions.push({ [Op.or]: [{ title: { [Op.like]: q } }, { description: { [Op.like]: q } }] });
    appliedFilters.push(`search="${args.search.trim()}"`);
  }

  let statusFilterFailed: string | null = null;
  if (args?.status && typeof args.status === 'string' && args.status.trim()) {
    const status = await TicketStatus.findOne({
      where: { name: { [Op.like]: args.status.trim() } },
    });
    if (status) { where.statusId = status.id; appliedFilters.push(`status=${status.name}`); }
    else statusFilterFailed = args.status;
  }

  let collectionFilterFailed: string | null = null;
  if (args?.collection && typeof args.collection === 'string' && args.collection.trim()) {
    const collection = await Collection.findOne({
      where: { organizationId: ctx.organizationId, name: { [Op.like]: `%${args.collection.trim()}%` } },
    });
    if (collection) { where.collectionId = collection.id; appliedFilters.push(`collection=${collection.name}`); }
    else collectionFilterFailed = args.collection;
  }

  if (andConditions.length) where[Op.and as any] = andConditions;

  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 50);

  const tickets = await Ticket.findAll({
    where,
    include: ticketInclude,
    order: [['updatedAt', 'DESC']],
    limit,
  });

  const notes: string[] = [];
  if (statusFilterFailed)
    notes.push(
      `Status "${statusFilterFailed}" not recognized; filter was ignored. Valid: Open, In Progress, Ready for QA, Error Persists, Resolved, Closed.`,
    );
  if (collectionFilterFailed)
    notes.push(`Collection "${collectionFilterFailed}" not found; filter was ignored. Use list_collections to see available collections.`);

  return {
    result: {
      count: tickets.length,
      appliedFilters: appliedFilters.length ? appliedFilters : ['none — all org tickets'],
      note: notes.length ? notes.join(' ') : undefined,
      tickets: tickets.map(toSummary),
    },
    ticketRefs: tickets.map(toTicketRef),
  };
};

const queryComments = async (ctx: ToolContext, args: any) => {
  const where: any = {};
  if (asBool(args?.authoredByMe)) where.authorId = ctx.userId;

  if (args?.authorName && typeof args.authorName === 'string' && args.authorName.trim()) {
    const users = await User.findAll({
      where: { organizationId: ctx.organizationId, name: { [Op.like]: `%${args.authorName.trim()}%` } },
      attributes: ['id'],
    });
    if (users.length === 0) {
      return { result: { totalMatching: 0, comments: [], note: `No member named "${args.authorName}" found.` }, ticketRefs: [] };
    }
    where.authorId = asBool(args?.authoredByMe) ? ctx.userId : { [Op.in]: users.map((u: any) => u.id) };
  }

  if (args?.ticketId && typeof args.ticketId === 'string' && args.ticketId.trim()) {
    where.ticketId = args.ticketId.trim();
  }
  if (args?.search && typeof args.search === 'string' && args.search.trim()) {
    where.body = { [Op.like]: `%${args.search.trim()}%` };
  }

  // Tenant isolation via an INNER JOIN on the org's tickets (older comment
  // rows may have a NULL organization_id, so never trust that column alone).
  const ticketJoin = {
    model: Ticket,
    as: 'ticket',
    attributes: ['id', 'title', 'priority', 'collectionId'],
    where: { organizationId: ctx.organizationId },
    required: true,
    include: [{ model: TicketStatus, as: 'status', attributes: ['name'] }],
  };

  const limit = Math.min(Math.max(Number(args?.limit) || 15, 1), 30);

  const [totalMatching, comments] = await Promise.all([
    Comment.count({ where, include: [{ model: Ticket, as: 'ticket', where: { organizationId: ctx.organizationId }, required: true }] }),
    Comment.findAll({
      where,
      include: [ticketJoin, { model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit,
    }),
  ]);

  const refMap = new Map<string, any>();
  for (const c of comments as any[]) {
    if (c.ticket) refMap.set(c.ticket.id, { id: c.ticket.id, title: c.ticket.title, status: c.ticket.status?.name, priority: c.ticket.priority || undefined, collectionId: c.ticket.collectionId ?? null });
  }

  return {
    result: {
      totalMatching,
      showing: comments.length,
      comments: (comments as any[]).map((c) => ({
        author: c.author?.name || 'Unknown',
        body: String(c.body || '').slice(0, 400),
        createdAt: formatPhDateTime(c.createdAt),
        ticket: c.ticket ? { id: c.ticket.id, title: c.ticket.title } : null,
      })),
    },
    ticketRefs: Array.from(refMap.values()),
  };
};

const queryActivity = async (ctx: ToolContext, args: any) => {
  const where: any = {};
  if (asBool(args?.byMe)) where.actorId = ctx.userId;

  if (args?.actorName && typeof args.actorName === 'string' && args.actorName.trim()) {
    const users = await User.findAll({
      where: { organizationId: ctx.organizationId, name: { [Op.like]: `%${args.actorName.trim()}%` } },
      attributes: ['id'],
    });
    if (users.length === 0) {
      return { result: { totalMatching: 0, events: [], note: `No member named "${args.actorName}" found.` }, ticketRefs: [] };
    }
    where.actorId = asBool(args?.byMe) ? ctx.userId : { [Op.in]: users.map((u: any) => u.id) };
  }

  if (args?.type && typeof args.type === 'string' && args.type.trim()) {
    where.type = args.type.trim();
  }
  if (args?.ticketId && typeof args.ticketId === 'string' && args.ticketId.trim()) {
    where.ticketId = args.ticketId.trim();
  }

  const ticketJoin = {
    model: Ticket,
    as: 'ticket',
    attributes: ['id', 'title', 'priority', 'collectionId'],
    where: { organizationId: ctx.organizationId },
    required: true,
    include: [{ model: TicketStatus, as: 'status', attributes: ['name'] }],
  };

  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 40);

  const [totalMatching, events] = await Promise.all([
    TicketEvent.count({ where, include: [{ model: Ticket, as: 'ticket', where: { organizationId: ctx.organizationId }, required: true }] }),
    TicketEvent.findAll({
      where,
      include: [ticketJoin, { model: User, as: 'actor', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit,
    }),
  ]);

  const refMap = new Map<string, any>();
  for (const e of events as any[]) {
    if (e.ticket) refMap.set(e.ticket.id, { id: e.ticket.id, title: e.ticket.title, status: e.ticket.status?.name, priority: e.ticket.priority || undefined, collectionId: e.ticket.collectionId ?? null });
  }

  return {
    result: {
      totalMatching,
      showing: events.length,
      events: (events as any[]).map((e) => ({
        type: e.type,
        from: e.fromValue,
        to: e.toValue,
        actor: e.actor?.name || 'System',
        createdAt: formatPhDateTime(e.createdAt),
        ticket: e.ticket ? { id: e.ticket.id, title: e.ticket.title } : null,
      })),
    },
    ticketRefs: Array.from(refMap.values()),
  };
};

const findDuplicateTickets = async (ctx: ToolContext, args: any) => {
  let collectionId: string | null = null;
  let collectionName: string | null = null;

  if (args?.collection && typeof args.collection === 'string' && args.collection.trim()) {
    const collection = await Collection.findOne({
      where: { organizationId: ctx.organizationId, name: { [Op.like]: `%${args.collection.trim()}%` } },
    });
    if (!collection) {
      return {
        result: { error: `Collection "${args.collection}" not found. Use list_collections to see available collections.` },
        ticketRefs: [],
      };
    }
    collectionId = collection.id;
    collectionName = collection.name;
  }

  const { groups, analyzedCount } = await detectDuplicates(ctx.organizationId, collectionId);

  const refs: TicketRef[] = [];
  for (const g of groups) for (const t of g.tickets) refs.push(t);

  return {
    result: {
      scope: collectionName ? `collection "${collectionName}"` : 'all collections',
      analyzedTickets: analyzedCount,
      duplicateGroupCount: groups.length,
      groups: groups.map((g, i) => ({
        group: i + 1,
        reason: g.reason,
        confidence: g.confidence || 'high',
        tickets: g.tickets.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
      })),
      note:
        groups.length > 0
          ? 'The app shows interactive review controls (Open / Delete / Keep) under your reply — invite the user to use them. You cannot delete tickets yourself.'
          : 'No likely duplicates found.',
    },
    ticketRefs: refs,
    duplicateGroups: groups,
  };
};

const listCollectionsTool = async (ctx: ToolContext) => {
  const [collections, tickets] = await Promise.all([
    Collection.findAll({ where: { organizationId: ctx.organizationId }, order: [['createdAt', 'ASC']] }),
    Ticket.findAll({ where: { organizationId: ctx.organizationId }, attributes: ['collectionId'] }),
  ]);
  const counts = new Map<string, number>();
  for (const t of tickets as any[]) {
    const key = String(t.collectionId || '');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return {
    result: {
      collections: collections.map((c: any) => ({
        name: c.name,
        description: c.description || null,
        ticketCount: counts.get(String(c.id)) || 0,
        createdAt: formatPhDateTime(c.createdAt),
      })),
    },
    ticketRefs: [],
  };
};

const getTicketDetails = async (ctx: ToolContext, args: any) => {
  const ticketId = String(args?.ticketId || '').trim();
  if (!ticketId) return { result: { error: 'ticketId is required' }, ticketRefs: [] };

  const ticket: any = await Ticket.findByPk(ticketId, { include: ticketInclude });

  if (!ticket || String(ticket.organizationId) !== String(ctx.organizationId)) {
    return { result: { error: 'Ticket not found in your organization.' }, ticketRefs: [] };
  }

  const [comments, events, approvals] = await Promise.all([
    Comment.findAll({
      where: { ticketId },
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    TicketEvent.findAll({
      where: { ticketId },
      include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: 15,
    }),
    Approval.findAll({
      where: { ticketId },
      include: [{ model: User, as: 'approver', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: 5,
    }),
  ]);

  return {
    result: {
      ticket: {
        ...toSummary(ticket),
        description: ticket.description,
        jamUrl: ticket.jamUrl || null,
      },
      approvals: approvals.map((a: any) => ({
        status: a.status,
        approver: a.approver?.name || 'Unknown',
        comment: a.comment || null,
        createdAt: formatPhDateTime(a.createdAt),
      })),
      recentComments: comments.map((c: any) => ({
        author: c.author?.name || 'Unknown',
        body: String(c.body || '').slice(0, 500),
        createdAt: formatPhDateTime(c.createdAt),
      })),
      recentActivity: events.map((e: any) => ({
        type: e.type,
        from: e.fromValue,
        to: e.toValue,
        actor: e.actor?.name || 'System',
        createdAt: formatPhDateTime(e.createdAt),
      })),
    },
    ticketRefs: [toTicketRef(ticket)],
  };
};

const getTicketStats = async (ctx: ToolContext) => {
  const [tickets, assignedIds] = await Promise.all([
    Ticket.findAll({
      where: { organizationId: ctx.organizationId },
      include: [{ model: TicketStatus, as: 'status', attributes: ['name'] }],
      attributes: ['id', 'priority', 'assignedTo', 'reportedBy', 'statusId'],
    }) as Promise<any[]>,
    findTicketIdsAssignedToUser(ctx.organizationId, ctx.userId),
  ]);
  const assignedIdSet = new Set(assignedIds.map((x) => String(x)));

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let assignedToMe = 0;
  let reportedByMe = 0;
  let unassigned = 0;

  for (const t of tickets) {
    const s = t.status?.name || 'Unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
    const p = t.priority || 'None';
    byPriority[p] = (byPriority[p] || 0) + 1;
    // Assigned to me = primary owner OR a member of the assignee set.
    if (String(t.assignedTo) === String(ctx.userId) || assignedIdSet.has(String(t.id))) assignedToMe += 1;
    if (String(t.reportedBy) === String(ctx.userId)) reportedByMe += 1;
    if (!t.assignedTo) unassigned += 1;
  }

  return {
    result: { total: tickets.length, byStatus, byPriority, assignedToMe, reportedByMe, unassigned },
    ticketRefs: [],
  };
};

const listTeamMembers = async (ctx: ToolContext) => {
  const users = await User.findAll({
    where: { organizationId: ctx.organizationId },
    attributes: ['id', 'name', 'email'],
    limit: 100,
  });
  return {
    result: { members: users.map((u: any) => ({ id: u.id, name: u.name, email: u.email })) },
    ticketRefs: [],
  };
};

export interface ToolExecution {
  result: any;
  ticketRefs: TicketRef[];
  duplicateGroups?: DuplicateGroup[];
}

export const executeTool = async (
  ctx: ToolContext,
  name: string,
  args: any,
): Promise<ToolExecution> => {
  try {
    switch (name) {
      case 'query_tickets':
        return await queryTickets(ctx, args);
      case 'get_ticket_details':
        return await getTicketDetails(ctx, args);
      case 'query_comments':
        return await queryComments(ctx, args);
      case 'query_activity':
        return await queryActivity(ctx, args);
      case 'find_duplicate_tickets':
        return await findDuplicateTickets(ctx, args);
      case 'list_collections':
        return await listCollectionsTool(ctx);
      case 'get_ticket_stats':
        return await getTicketStats(ctx);
      case 'list_team_members':
        return await listTeamMembers(ctx);
      default:
        return { result: { error: `Unknown tool: ${name}` }, ticketRefs: [] };
    }
  } catch (error: any) {
    console.error(`[ai] tool ${name} failed:`, error);
    return { result: { error: `Tool ${name} failed: ${error.message}` }, ticketRefs: [] };
  }
};
