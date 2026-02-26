import { Request, Response } from 'express';
import * as ticketService from '../services/ticket.service';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const updateTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        // The ticketService.updateTicket function requires the roleId to perform authorization.
        // To allow developers to change the status, the logic must be adjusted in the service layer.
        const updatedTicket = await ticketService.updateTicket(req.params.id, req.body as UpdateTicketDto, req.user.id, req.user.roleId);
        if (!updatedTicket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        res.status(200).json(updatedTicket);
    } catch (error: any) {
        if (error.message.includes('Testers are not allowed to assign tickets to Admins')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error updating ticket', error: error.message });
    }
}