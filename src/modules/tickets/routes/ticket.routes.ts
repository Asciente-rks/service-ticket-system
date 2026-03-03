import { Router } from 'express';
import { createTicket } from '../controllers/create-ticket.controller';
import { listTickets } from '../controllers/list-tickets.controller';
import { getTicket } from '../controllers/get-ticket.controller';
import { updateTicket } from '../controllers/update-ticket.controller';
import { addApproval } from '../controllers/approval.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { authorizeRoles } from '../../../middlewares/permissions.middleware';
import { ROLES } from '../../../config/roles';
import { validate } from '../../../middlewares/validator.middleware';
import {
    createTicketSchema,
    ticketIdParamsSchema,
    updateTicketSchema,
    createApprovalSchema
} from '../../../utils/ticket.validation';

export const ticketRouter = Router();

ticketRouter.post('/', authenticateToken, authorizeRoles([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TESTER]), validate(createTicketSchema), createTicket);
ticketRouter.get('/', authenticateToken, listTickets);
ticketRouter.get('/:id', authenticateToken, validate(ticketIdParamsSchema), getTicket);
ticketRouter.patch('/:id', authenticateToken, validate(updateTicketSchema), updateTicket);
ticketRouter.post('/:id/approval', authenticateToken, authorizeRoles([ROLES.SUPER_ADMIN, ROLES.ADMIN]), validate(createApprovalSchema), addApproval);