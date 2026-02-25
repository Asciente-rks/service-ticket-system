import { Request, Response } from 'express';
import * as ticketService from '../services/ticket.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const listTickets = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const tickets = await ticketService.getAllTickets(req.user.id, req.user.roleId);
        res.status(200).json(tickets);
    } catch (error: any) {
        res.status(500).json({ message: 'Error listing tickets', error: error.message });
    }
}