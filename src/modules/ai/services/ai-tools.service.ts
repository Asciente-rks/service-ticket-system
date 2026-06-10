import { Op } from 'sequelize';
import { Ticket } from '../../tickets/models/ticket.model';
import { TicketStatus } from '../../tickets/models/ticket-status.model';
import { User } from '../../users/models/user.model';
import { Comment } from '../../tickets/models/comment.model';
import { TicketEvent } from '../../tickets/models/ticket-event.model';
import { ToolDefinition } from './ai-provider.service';

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
}

export interface ToolContext {
  organizationId: string;
  userId: string;
}

const ticketInclude = [
  { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
  { model: TicketStatus, as: 'status', attributes: ['id', 'name'] },
];

const toSummary = (t: any) => ({
  id: t.id,
  title: t.title,
  status: t.status?.name || 'Unknown',
  priority: t.priority || 'None',
  reporter: t.reporter?.name || 'Unknown',
  assignee: t.assignee?.name || 'Unassigned',
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

export const toolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'query_tickets',
      description:
        "Search and list tickets in the user's organization. Use for questions like 'how many tickets are assigned to me', 'show open high priority tickets', 'tickets reported by me', 'find tickets about login'. Returns matching tickets with id, title, status, priority, reporter, assignee.",
      parameters: {
        type: 'object',
        properties: {
          assignedToMe: {
            type: 'boolean',
            description: 'Only tickets assigned to the current user.',
          },
          reportedByMe: {
            type: 'boolean',
            description: 'Only tickets reported/created by the current user.',
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

  if (args?.assignedToMe) where.assignedTo = ctx.userId;
  if (args?.reportedByMe) where.reportedBy = ctx.userId;

  if (args?.priority && typeof args.priority === 'string') {
    const p = args.priority.trim().toLowerCase();
    const valid: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };
    if (valid[p]) where.priority = valid[p];
  }

  if (args?.search && typeof args.search === 'string' && args.search.trim()) {
    const q = `%${args.search.trim()}%`;
    where[Op.or as any] = [{ title: { [Op.like]: q } }, { description: { [Op.like]: q } }];
  }

  let statusFilterFailed: string | null = null;
  if (args?.status && typeof args.status === 'string' && args.status.trim()) {
    const status = await TicketStatus.findOne({
      where: { name: { [Op.like]: args.status.trim() } },
    });
    if (status) where.statusId = status.id;
    else statusFilterFailed = args.status;
  }

  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 50);

  const tickets = await Ticket.findAll({
    where,
    include: ticketInclude,
    order: [['updatedAt', 'DESC']],
    limit,
  });

  return {
    result: {
      count: tickets.length,
      note: statusFilterFailed
        ? `Status "${statusFilterFailed}" not recognized; filter was ignored. Valid: Open, In Progress, Ready for QA, Error Persists, Resolved, Closed.`
        : undefined,
      tickets: tickets.map(toSummary),
    },
    ticketRefs: tickets.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status?.name,
      priority: t.priority || undefined,
    })),
  };
};

const getTicketDetails = async (ctx: ToolContext, args: any) => {
  const ticketId = String(args?.ticketId || '').trim();
  if (!ticketId) return { result: { error: 'ticketId is required' }, ticketRefs: [] };

  const ticket: any = await Ticket.findByPk(ticketId, { include: ticketInclude });

  if (!ticket || String(ticket.organizationId) !== String(ctx.organizationId)) {
    return { result: { error: 'Ticket not found in your organization.' }, ticketRefs: [] };
  }

  const [comments, events] = await Promise.all([
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
  ]);

  return {
    result: {
      ticket: {
        ...toSummary(ticket),
        description: ticket.description,
        jamUrl: ticket.jamUrl || null,
      },
      recentComments: comments.map((c: any) => ({
        author: c.author?.name || 'Unknown',
        body: String(c.body || '').slice(0, 500),
        createdAt: c.createdAt,
      })),
      recentActivity: events.map((e: any) => ({
        type: e.type,
        from: e.fromValue,
        to: e.toValue,
        actor: e.actor?.name || 'System',
        createdAt: e.createdAt,
      })),
    },
    ticketRefs: [
      {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status?.name,
        priority: ticket.priority || undefined,
      },
    ],
  };
};

const getTicketStats = async (ctx: ToolContext) => {
  const tickets: any[] = await Ticket.findAll({
    where: { organizationId: ctx.organizationId },
    include: [{ model: TicketStatus, as: 'status', attributes: ['name'] }],
    attributes: ['id', 'priority', 'assignedTo', 'reportedBy', 'statusId'],
  });

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
    if (String(t.assignedTo) === String(ctx.userId)) assignedToMe += 1;
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

export const executeTool = async (
  ctx: ToolContext,
  name: string,
  args: any,
): Promise<{ result: any; ticketRefs: TicketRef[] }> => {
  try {
    switch (name) {
      case 'query_tickets':
        return await queryTickets(ctx, args);
      case 'get_ticket_details':
        return await getTicketDetails(ctx, args);
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
