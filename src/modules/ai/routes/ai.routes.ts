import { Router } from 'express';
import {
  getStatus,
  listConversations,
  createConversation,
  getMessages,
  sendMessage,
  renameConversation,
  deleteConversation,
  askAboutTicket,
} from '../controllers/ai.controller';
import { authenticateToken, requireOrganization } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import { rateLimit } from '../../../middlewares/rate-limit.middleware';
import { ensureAiTables } from '../services/ai-bootstrap.service';
import { Request, Response, NextFunction } from 'express';
import {
  createAiConversationSchema,
  aiConversationIdParamsSchema,
  sendAiMessageSchema,
  renameAiConversationSchema,
  askTicketAiSchema,
} from '../../../utils/ai.validation';

export const aiRouter = Router();

// All AI endpoints are authenticated and tenant-scoped.
aiRouter.use(authenticateToken, requireOrganization);

// Ensure AI tables exist before any handler touches them (no-op after first call).
aiRouter.use((req: Request, res: Response, next: NextFunction) => {
  ensureAiTables()
    .then(() => next())
    .catch((err) => {
      console.error('[ai] failed to ensure AI tables:', err);
      res.status(500).json({ message: 'AI storage is not available right now.' });
    });
});

// Per-IP guard on the endpoints that actually hit LLM providers, so a single
// user can't burn the shared free-tier quota.
const aiGenerationLimiter = rateLimit({
  limit: 20,
  windowMs: 60_000,
  bucketKey: 'ai-generate',
});

aiRouter.get('/status', getStatus);

aiRouter.get('/conversations', listConversations);
aiRouter.post('/conversations', validate(createAiConversationSchema), createConversation);
aiRouter.get('/conversations/:id/messages', validate(aiConversationIdParamsSchema), getMessages);
aiRouter.post(
  '/conversations/:id/messages',
  aiGenerationLimiter,
  validate(sendAiMessageSchema),
  sendMessage,
);
aiRouter.patch('/conversations/:id', validate(renameAiConversationSchema), renameConversation);
aiRouter.delete('/conversations/:id', validate(aiConversationIdParamsSchema), deleteConversation);

// In-ticket assistant (summarize / contextual Q&A) — stateless.
aiRouter.post('/tickets/:ticketId/ask', aiGenerationLimiter, validate(askTicketAiSchema), askAboutTicket);
