import {
  chatCompletion,
  ChatMessage,
  aiConfigured,
} from './ai-provider.service';
import { toolDefinitions, executeTool, ToolContext, TicketRef } from './ai-tools.service';
import { AiConversation } from '../models/ai-conversation.model';
import { AiMessage } from '../models/ai-message.model';
import { Ticket } from '../../tickets/models/ticket.model';
import { TicketStatus } from '../../tickets/models/ticket-status.model';
import { User } from '../../users/models/user.model';
import { Comment } from '../../tickets/models/comment.model';
import { TicketEvent } from '../../tickets/models/ticket-event.model';

const MAX_TOOL_ROUNDS = 4;
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `You are the AI assistant built into NexusTrack, a service ticket system. You help members of an organization understand and manage their tickets.

You can call tools to look up real ticket data (counts, lists, details, stats, team members). Always prefer tool data over guessing — never invent tickets or numbers.

When you mention a specific ticket in your reply, reference it inline using EXACTLY this format: [ticket:TICKET_ID|TICKET_TITLE] — for example "[ticket:123e4567-e89b-12d3-a456-426614174000|Login button broken]". The app renders these as clickable links that open the ticket, so use one for every ticket you mention. Do not wrap them in markdown links or code blocks.

Style:
- Be concise and helpful. Use short paragraphs and simple markdown (bold, bullet lists).
- When listing tickets, give a brief one-line description per ticket with its status and priority.
- If a question is ambiguous, answer the most likely interpretation and note the assumption.
- You only have read access. To create or change tickets, point the user to the relevant UI action (e.g. "use the New Ticket button on the Dashboard").
- Politely decline questions unrelated to the ticket system, the team's work, or general productivity help.`;

export interface SendMessageResult {
  conversation: {
    id: string;
    title: string;
  };
  userMessage: any;
  assistantMessage: any;
}

const toConversationDto = (c: AiConversation) => ({
  id: c.id,
  title: c.title,
  lastMessageAt: c.lastMessageAt,
  lastMessagePreview: c.lastMessagePreview,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const toMessageDto = (m: AiMessage) => {
  let ticketRefs: TicketRef[] = [];
  let meta: any = null;
  try {
    if (m.ticketRefs) ticketRefs = JSON.parse(m.ticketRefs);
  } catch {
    /* ignore */
  }
  try {
    if (m.meta) meta = JSON.parse(m.meta);
  } catch {
    /* ignore */
  }
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    body: m.body,
    ticketRefs,
    meta,
    createdAt: m.createdAt,
  };
};

export const isConfigured = aiConfigured;

export const listConversations = async (organizationId: string, userId: string) => {
  const conversations = await AiConversation.findAll({
    where: { organizationId, userId },
    order: [
      ['lastMessageAt', 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit: 50,
  });
  return conversations.map(toConversationDto);
};

export const createConversation = async (
  organizationId: string,
  userId: string,
  title?: string,
) => {
  const conversation = await AiConversation.create({
    organizationId,
    userId,
    title: (title || 'New chat').slice(0, 255),
  });
  return toConversationDto(conversation);
};

const findOwnedConversation = async (
  organizationId: string,
  userId: string,
  conversationId: string,
) => {
  const conversation = await AiConversation.findByPk(conversationId);
  if (
    !conversation ||
    String(conversation.organizationId) !== String(organizationId) ||
    String(conversation.userId) !== String(userId)
  ) {
    const err: any = new Error('Conversation not found.');
    err.statusCode = 404;
    throw err;
  }
  return conversation;
};

export const getMessages = async (
  organizationId: string,
  userId: string,
  conversationId: string,
) => {
  const conversation = await findOwnedConversation(organizationId, userId, conversationId);
  const messages = await AiMessage.findAll({
    where: { conversationId: conversation.id },
    order: [['createdAt', 'ASC']],
    limit: 200,
  });
  return {
    conversation: toConversationDto(conversation),
    messages: messages.map(toMessageDto),
  };
};

export const renameConversation = async (
  organizationId: string,
  userId: string,
  conversationId: string,
  title: string,
) => {
  const conversation = await findOwnedConversation(organizationId, userId, conversationId);
  conversation.title = title.slice(0, 255);
  await conversation.save();
  return toConversationDto(conversation);
};

export const deleteConversation = async (
  organizationId: string,
  userId: string,
  conversationId: string,
) => {
  const conversation = await findOwnedConversation(organizationId, userId, conversationId);
  await AiMessage.destroy({ where: { conversationId: conversation.id } });
  await conversation.destroy();
};

/** Extract [ticket:id|title] refs the model wrote inline (dedup by id). */
const extractInlineRefs = (text: string): TicketRef[] => {
  const refs: TicketRef[] = [];
  const seen = new Set<string>();
  const pattern = /\[ticket:([0-9a-fA-F-]{36})\|([^\]]{1,300})\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      refs.push({ id, title: match[2] });
    }
  }
  return refs;
};

/**
 * Core agent loop: send history + tools, execute any tool calls, feed results
 * back, repeat until the model produces a final text answer.
 */
const runAgentLoop = async (
  ctx: ToolContext,
  history: ChatMessage[],
): Promise<{ content: string; ticketRefs: TicketRef[]; provider: string; model: string }> => {
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
  const collectedRefs: Map<string, TicketRef> = new Map();
  let provider = '';
  let model = '';

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const isLastRound = round === MAX_TOOL_ROUNDS;
    const result = await chatCompletion(messages, isLastRound ? undefined : toolDefinitions);
    provider = result.provider;
    model = result.model;

    if (!result.toolCalls.length) {
      const content = (result.content || '').trim() || "I couldn't generate a response. Please try rephrasing your question.";
      const inlineRefs = extractInlineRefs(content);
      for (const ref of inlineRefs) {
        const existing = collectedRefs.get(ref.id);
        collectedRefs.set(ref.id, existing ? { ...existing, title: existing.title } : ref);
      }
      // Only surface refs the model actually mentioned, falling back to tool
      // results when it mentioned none explicitly (e.g. pure list answers).
      const refs =
        inlineRefs.length > 0
          ? inlineRefs.map((r) => collectedRefs.get(r.id) || r)
          : Array.from(collectedRefs.values()).slice(0, 20);
      return { content, ticketRefs: refs, provider, model };
    }

    // Record the assistant turn containing tool calls.
    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls,
    });

    // Execute each requested tool and append its result.
    for (const call of result.toolCalls) {
      let args: any = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      const { result: toolResult, ticketRefs } = await executeTool(ctx, call.function.name, args);
      for (const ref of ticketRefs) collectedRefs.set(ref.id, ref);
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(toolResult).slice(0, 12_000),
      });
    }
  }

  // Should be unreachable (last round disables tools), but keep a safe fallback.
  return {
    content: 'I gathered the data but ran out of reasoning steps. Please try a more specific question.',
    ticketRefs: Array.from(collectedRefs.values()).slice(0, 20),
    provider,
    model,
  };
};

export const sendMessage = async (
  organizationId: string,
  userId: string,
  conversationId: string,
  body: string,
): Promise<SendMessageResult> => {
  const conversation = await findOwnedConversation(organizationId, userId, conversationId);

  const userMessage = await AiMessage.create({
    conversationId: conversation.id,
    role: 'user',
    body,
  });

  // Build chat history for the model (most recent HISTORY_LIMIT messages).
  const recent = await AiMessage.findAll({
    where: { conversationId: conversation.id },
    order: [['createdAt', 'DESC']],
    limit: HISTORY_LIMIT,
  });
  const history: ChatMessage[] = recent
    .reverse()
    .map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.body,
    }));

  const ctx: ToolContext = { organizationId, userId };

  let reply: { content: string; ticketRefs: TicketRef[]; provider: string; model: string };
  try {
    reply = await runAgentLoop(ctx, history);
  } catch (error: any) {
    // Persist a friendly assistant-side error so the thread stays coherent.
    const friendly =
      error?.statusCode === 429
        ? 'All AI providers are currently rate-limited. Please try again in a minute or two.'
        : error?.statusCode === 503
          ? 'AI is not configured on the server yet (missing GROQ_API_KEY / GEMINI_API_KEY).'
          : 'Something went wrong while generating a response. Please try again.';
    const assistantMessage = await AiMessage.create({
      conversationId: conversation.id,
      role: 'assistant',
      body: friendly,
      meta: JSON.stringify({ error: true, statusCode: error?.statusCode || 500 }),
    });
    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = friendly.slice(0, 300);
    await conversation.save();
    return {
      conversation: { id: conversation.id, title: conversation.title },
      userMessage: toMessageDto(userMessage),
      assistantMessage: toMessageDto(assistantMessage),
    };
  }

  const assistantMessage = await AiMessage.create({
    conversationId: conversation.id,
    role: 'assistant',
    body: reply.content,
    ticketRefs: reply.ticketRefs.length ? JSON.stringify(reply.ticketRefs) : null,
    meta: JSON.stringify({ provider: reply.provider, model: reply.model }),
  });

  // Auto-title brand-new chats from the first user message.
  const isDefaultTitle = conversation.title === 'New chat';
  if (isDefaultTitle) {
    conversation.title = body.slice(0, 60) + (body.length > 60 ? '…' : '');
  }
  conversation.lastMessageAt = new Date();
  conversation.lastMessagePreview = reply.content.slice(0, 300);
  await conversation.save();

  return {
    conversation: { id: conversation.id, title: conversation.title },
    userMessage: toMessageDto(userMessage),
    assistantMessage: toMessageDto(assistantMessage),
  };
};

/**
 * One-shot, stateless Q&A about a specific ticket (the in-modal assistant).
 * Loads the full ticket context server-side, so the model never needs tools.
 */
export const askAboutTicket = async (
  organizationId: string,
  userId: string,
  ticketId: string,
  question: string | undefined,
  history: { role: string; body: string }[] = [],
) => {
  const ticket: any = await Ticket.findByPk(ticketId, {
    include: [
      { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
      { model: TicketStatus, as: 'status', attributes: ['id', 'name'] },
    ],
  });

  if (!ticket || String(ticket.organizationId) !== String(organizationId)) {
    const err: any = new Error('Ticket not found.');
    err.statusCode = 404;
    throw err;
  }

  const [comments, events] = await Promise.all([
    Comment.findAll({
      where: { ticketId },
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['createdAt', 'ASC']],
      limit: 30,
    }),
    TicketEvent.findAll({
      where: { ticketId },
      include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
      order: [['createdAt', 'ASC']],
      limit: 30,
    }),
  ]);

  const contextBlock = JSON.stringify(
    {
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status?.name || 'Unknown',
        priority: ticket.priority || 'None',
        reporter: ticket.reporter?.name || 'Unknown',
        assignee: ticket.assignee?.name || 'Unassigned',
        jamUrl: ticket.jamUrl || null,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
      comments: comments.map((c: any) => ({
        author: c.author?.name || 'Unknown',
        body: String(c.body || '').slice(0, 600),
        createdAt: c.createdAt,
      })),
      activity: events.map((e: any) => ({
        type: e.type,
        from: e.fromValue,
        to: e.toValue,
        actor: e.actor?.name || 'System',
        createdAt: e.createdAt,
      })),
    },
    null,
    0,
  ).slice(0, 14_000);

  const systemPrompt = `You are the AI assistant inside a service ticket system, helping a user understand ONE specific ticket. The full ticket context (details, comments, activity timeline) is provided below as JSON. Answer questions strictly from this context — do not invent information. Be concise; use simple markdown.

When asked to summarize, cover: what the problem is, current status & priority, who reported it and who is working on it, key discussion points from comments, and the latest activity. Keep it tight (under ~180 words).

TICKET CONTEXT JSON:
${contextBlock}`;

  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  // Carry the in-modal mini conversation (bounded).
  for (const h of history.slice(-10)) {
    messages.push({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.body || '').slice(0, 2_000),
    });
  }

  messages.push({
    role: 'user',
    content:
      question && question.trim()
        ? question.trim().slice(0, 2_000)
        : 'Summarize this ticket: what is the problem, its current status, who is involved, and what happened recently?',
  });

  const result = await chatCompletion(messages, undefined, 700);

  return {
    answer: (result.content || '').trim() || 'No answer was generated. Please try again.',
    provider: result.provider,
    model: result.model,
  };
};
