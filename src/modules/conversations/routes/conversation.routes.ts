import { Router } from 'express';
import {
  listConversations,
  startConversation,
  getMessages,
  sendMessage,
  getUnreadTotal,
} from '../controllers/conversation.controller';
import { authenticateToken, requireOrganization } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import {
  startConversationSchema,
  sendMessageSchema,
  conversationIdParamsSchema,
} from '../../../utils/conversation.validation';

export const conversationRouter = Router();

// All conversation endpoints are authenticated and tenant-scoped.
conversationRouter.use(authenticateToken, requireOrganization);

conversationRouter.get('/', listConversations);
conversationRouter.post('/', validate(startConversationSchema), startConversation);
conversationRouter.get('/unread-count', getUnreadTotal);
conversationRouter.get('/:id/messages', validate(conversationIdParamsSchema), getMessages);
conversationRouter.post('/:id/messages', validate(sendMessageSchema), sendMessage);
