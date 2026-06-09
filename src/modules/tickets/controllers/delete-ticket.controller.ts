import { Response } from 'express';
import * as ticketService from '../services/ticket.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const deleteTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const deleted = await ticketService.deleteTicket(
            req.params.id,
            req.user.organizationId as string,
            req.user.id,
            req.user.roleId ?? '',
        );

        if (!deleted) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        res.status(200).json({ message: 'Ticket deleted', id: req.params.id });
    } catch (error: any) {
        const status = error.statusCode || 500;
        res.status(status).json({ message: error.message || 'Error deleting ticket' });
    }
};
