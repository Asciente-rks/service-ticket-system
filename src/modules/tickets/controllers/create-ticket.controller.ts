import { Response } from 'express';
import * as ticketService from '../services/ticket.service';
import { CreateTicketDto } from '../dtos/create-ticket.dto';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const createTicket = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const ticket = await ticketService.createTicket(req.body as CreateTicketDto, req.user.id, req.user.roleId);
        res.status(201).json(ticket);
    } catch (error: any) {
        if (
            error.message.includes('Invalid priority') ||
            error.message.includes('assign')
        ) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error creating ticket', error: error.message });
    }
}