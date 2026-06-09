import * as yup from 'yup';

export const startConversationSchema = yup.object({
  body: yup.object({
    userId: yup.string().uuid('Invalid user id').required('A user to message is required'),
  }),
});

export const conversationIdParamsSchema = yup.object({
  params: yup.object({
    id: yup.string().uuid('Invalid conversation id').required('Conversation id is required'),
  }),
});

export const sendMessageSchema = yup.object({
  body: yup.object({
    body: yup.string().trim().required('Message cannot be empty').max(5000, 'Message is too long (max 5000 characters)'),
  }),
  params: yup.object({
    id: yup.string().uuid('Invalid conversation id').required('Conversation id is required'),
  }),
});
