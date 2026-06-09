import cron from 'node-cron';
import { Op } from 'sequelize';
import { Ticket } from '../models/ticket.model';
import { TicketStatus } from '../models/ticket-status.model';
import * as notificationService from '../../notifications/services/notification.service';
import { STATUSES } from '../../../config/statuses';

/**
 * SLA housekeeping job: find High priority tickets that are assigned, not
 * resolved/closed, and untouched for 24h, and nudge the assignee.
 *
 * Exported standalone so it can be invoked either by the in-process cron
 * (local dev) or by an EventBridge schedule that triggers the Lambda handler.
 */
export const runStaleTicketCheck = async (): Promise<void> => {
    console.log('Running Stale Ticket Checker Job...');

    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const staleTickets = await Ticket.findAll({
            where: {
                priority: 'High',
                updatedAt: {
                    [Op.lt]: staleThreshold,
                },
                assignedTo: {
                    [Op.ne]: null as any,
                },
            },
            include: [{ model: TicketStatus, as: 'status' }],
        });

        for (const ticket of staleTickets) {
            if (
                (ticket as any).status?.id !== STATUSES.RESOLVED &&
                (ticket as any).status?.id !== STATUSES.CLOSED
            ) {
                await notificationService.createNotification({
                    userId: ticket.assignedTo!,
                    ticketId: ticket.id,
                    organizationId: (ticket as any).organizationId,
                    message: `Reminder: High priority ticket "${ticket.title}" has not been updated for 24 hours.`,
                });
            }
        }

        console.log(`Stale Ticket Checker complete. Scanned ${staleTickets.length} candidate(s).`);
    } catch (error) {
        console.error('Error running stale-ticket job:', error);
    }
};

export const initCronJobs = () => {
    cron.schedule('0 9 * * *', () => {
        void runStaleTicketCheck();
    });
};
