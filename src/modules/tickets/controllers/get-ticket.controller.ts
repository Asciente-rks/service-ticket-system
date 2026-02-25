import { Request, Response } from 'express';
import * as ticketService from '../services/ticket.service';

export const getTicket = async (req: Request, res: Response) => {
    try {
        const ticket = await ticketService.getTicketById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        res.status(200).json(ticket);
    } catch (error: any) {
        res.status(500).json({ message: 'Error getting ticket', error: error.message });
    }
}