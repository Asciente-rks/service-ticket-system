import cron from 'node-cron';
import { Op } from 'sequelize';
import { Ticket } from '../models/ticket.model';
import { TicketStatus } from '../models/ticket-status.model';
import * as notificationService from '../../notifications/services/notification.service';
import { STATUSES } from '../../../config/statuses';

export const initCronJobs = () => {
    cron.schedule('0 9 * * *', async () => {
        console.log('Running Stale Ticket Checker Job...');
        
        const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

        try {
            const staleTickets = await Ticket.findAll({
                where: {
                    priority: 'High',
                    updatedAt: {
                        [Op.lt]: staleThreshold
                    },
                    assignedTo: {
                        [Op.ne]: null as any
                    }
                },
                include: [{ model: TicketStatus, as: 'status' }]
            });

            for (const ticket of staleTickets) {
                if ((ticket as any).status?.id !== STATUSES.RESOLVED && (ticket as any).status?.id !== STATUSES.CLOSED) {
                    await notificationService.createNotification({
                        userId: ticket.assignedTo!,
                        ticketId: ticket.id,
                        message: `Reminder: High priority ticket "${ticket.title}" has not been updated for 24 hours.`
                    });
                }
            }
        } catch (error) {
            console.error('Error running cron job:', error);
        }
    });
};