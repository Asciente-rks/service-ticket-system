import { Router } from 'express';
import { createTicket } from '../controllers/create-ticket.controller';
import { listTickets } from '../controllers/list-tickets.controller';
import { getTicket } from '../controllers/get-ticket.controller';
import { updateTicket } from '../controllers/update-ticket.controller';
import { addApproval } from '../controllers/approval.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { authorizeRoles } from '../../../middlewares/permissions.middleware';

export const ticketRouter = Router();

ticketRouter.post('/', authenticateToken, authorizeRoles(['Admin', 'Tester']), createTicket);
ticketRouter.get('/', authenticateToken, listTickets);
ticketRouter.get('/:id', authenticateToken, getTicket);
ticketRouter.patch('/:id', authenticateToken, authorizeRoles(['Admin', 'Tester', 'Developer']), updateTicket);
ticketRouter.post('/:id/approval', authenticateToken, authorizeRoles(['Admin']), addApproval);