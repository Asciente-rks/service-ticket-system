import { Response } from 'express';
import * as ticketService from '../services/ticket.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const getTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const ticket = await ticketService.getTicketById(req.params.id, req.user.organizationId as string);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        res.status(200).json(ticket);
    } catch (error: any) {
        res.status(500).json({ message: 'Error getting ticket', error: error.message });
    }
}
