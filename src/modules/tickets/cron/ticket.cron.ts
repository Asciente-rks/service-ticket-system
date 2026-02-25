import cron from 'node-cron';
import { Op } from 'sequelize';
import { Ticket } from '../models/ticket.model';
import { TicketStatus } from '../models/ticket-status.model';
import * as notificationService from '../../notifications/services/notification.service';

export const initCronJobs = () => {
    cron.schedule('* * * * *', async () => {
        console.log('Running Stale Ticket Checker Job...');
        
        const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

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
                if ((ticket as any).status?.name !== 'Resolved' && (ticket as any).status?.name !== 'Closed') {
                    await notificationService.createNotification({
                        userId: ticket.assignedTo!,
                        ticketId: ticket.id,
                        message: `Reminder: High priority ticket "${ticket.title}" has not been updated in 24 hours.`
                    });
                }
            }
        } catch (error) {
            console.error('Error running cron job:', error);
        }
    });
};