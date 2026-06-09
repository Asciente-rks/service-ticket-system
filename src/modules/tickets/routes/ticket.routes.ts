import { Router } from 'express';
import { createTicket } from '../controllers/create-ticket.controller';
import { listTickets } from '../controllers/list-tickets.controller';
import { getTicket } from '../controllers/get-ticket.controller';
import { updateTicket } from '../controllers/update-ticket.controller';
import { deleteTicket } from '../controllers/delete-ticket.controller';
import { addApproval } from '../controllers/approval.controller';
import { listComments, createComment, deleteComment, getTicketHistory } from '../controllers/comment.controller';
import { authenticateToken, requireOrganization } from '../../../middlewares/auth.middleware';
import { authorizeRoles } from '../../../middlewares/permissions.middleware';
import { ROLES } from '../../../config/roles';
import { validate } from '../../../middlewares/validator.middleware';
import { createTicketSchema, ticketIdParamsSchema, updateTicketSchema, createApprovalSchema, createCommentSchema } from '../../../utils/ticket.validation';
import { getStatuses } from '../controllers/fetch-status.controller';

export const ticketRouter = Router();

// Reference data — no auth, not tenant-scoped.
ticketRouter.get('/statuses', getStatuses);

// All ticket operations are tenant-scoped.
ticketRouter.use(authenticateToken, requireOrganization);

ticketRouter.post('/', authorizeRoles([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TESTER]), validate(createTicketSchema), createTicket);
ticketRouter.get('/', listTickets);
ticketRouter.get('/:id', validate(ticketIdParamsSchema), getTicket);
ticketRouter.patch('/:id', validate(updateTicketSchema), updateTicket);
ticketRouter.delete('/:id', validate(ticketIdParamsSchema), deleteTicket);
ticketRouter.post('/:id/approval', authorizeRoles([ROLES.SUPER_ADMIN, ROLES.ADMIN]), validate(createApprovalSchema), addApproval);

// Ticket timeline + comments (any org member can read/comment on their org's tickets).
ticketRouter.get('/:id/history', validate(ticketIdParamsSchema), getTicketHistory);
ticketRouter.get('/:id/comments', validate(ticketIdParamsSchema), listComments);
ticketRouter.post('/:id/comments', validate(createCommentSchema), createComment);
ticketRouter.delete('/:id/comments/:commentId', deleteComment);
