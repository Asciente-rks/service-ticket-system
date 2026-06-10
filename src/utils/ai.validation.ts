import * as yup from 'yup';

export const createAiConversationSchema = yup.object({
  body: yup.object({
    title: yup.string().trim().max(255, 'Title is too long (max 255 characters)').optional(),
  }),
});

export const aiConversationIdParamsSchema = yup.object({
  params: yup.object({
    id: yup.string().uuid('Invalid conversation id').required('Conversation id is required'),
  }),
});

export const sendAiMessageSchema = yup.object({
  body: yup.object({
    body: yup
      .string()
      .trim()
      .required('Message cannot be empty')
      .max(4000, 'Message is too long (max 4000 characters)'),
  }),
  params: yup.object({
    id: yup.string().uuid('Invalid conversation id').required('Conversation id is required'),
  }),
});

export const renameAiConversationSchema = yup.object({
  body: yup.object({
    title: yup
      .string()
      .trim()
      .required('Title cannot be empty')
      .max(255, 'Title is too long (max 255 characters)'),
  }),
  params: yup.object({
    id: yup.string().uuid('Invalid conversation id').required('Conversation id is required'),
  }),
});

export const askTicketAiSchema = yup.object({
  body: yup.object({
    question: yup.string().trim().max(2000, 'Question is too long (max 2000 characters)').optional(),
    history: yup
      .array()
      .of(
        yup.object({
          role: yup.string().oneOf(['user', 'assistant']).required(),
          body: yup.string().max(4000).required(),
        }),
      )
      .max(12, 'History is too long')
      .optional(),
  }),
  params: yup.object({
    ticketId: yup.string().uuid('Invalid ticket id').required('Ticket id is required'),
  }),
});
