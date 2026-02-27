import { Request, Response } from 'express';
import * as ticketService from '../services/ticket.service';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const updateTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const updatedTicket = await ticketService.updateTicket(req.params.id, req.body as UpdateTicketDto, req.user.id, req.user.roleId);
        if (!updatedTicket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        res.status(200).json(updatedTicket);
    } catch (error: any) {
        if (
            error.message.includes('assign') ||
            error.message.includes('Invalid priority') ||
            error.message.includes('not found')
        ) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error updating ticket', error: error.message });
    }
}