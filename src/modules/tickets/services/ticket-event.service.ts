import * as ticketEventRepository from '../repositories/ticket-event.repository';
import * as ticketRepository from '../repositories/ticket.repository';

export interface LogEventInput {
  ticketId: string;
  organizationId: string | null;
  actorId: string | null;
  type: 'reported' | 'assigned' | 'reassigned' | 'status_changed' | 'approved' | 'rejected';
  fromValue?: string | null;
  toValue?: string | null;
}

/** Fire-and-forget timeline logging — never blocks or fails the main action. */
export const logEvent = async (data: LogEventInput): Promise<void> => {
  try {
    await ticketEventRepository.create(data);
  } catch (err) {
    console.error('Ticket event log failed:', err);
  }
};

export const getHistory = async (ticketId: string, organizationId: string) => {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket || String((ticket as any).organizationId) !== String(organizationId)) {
    const err: any = new Error('Ticket not found.');
    err.statusCode = 404;
    throw err;
  }

  const events = await ticketEventRepository.findByTicket(ticketId);
  return events.map((e: any) => ({
    id: e.id,
    type: e.type,
    fromValue: e.fromValue ?? null,
    toValue: e.toValue ?? null,
    createdAt: e.createdAt,
    actor: e.actor ? { id: e.actor.id, name: e.actor.name } : null,
  }));
};
