import * as yup from 'yup';

export const createTicketSchema = yup.object({
    body: yup.object({
        title: yup.string().required('Title is required').min(5, 'Title must be at least 5 characters long'),
        description: yup.string().required('Description is required').min(10, 'Description must be at least 10 characters long'),
        priority: yup.string().oneOf(['Low', 'Medium', 'High'], 'Priority must be one of: Low, Medium, or High').optional(),
        assigneeId: yup.string().uuid('Assignee ID must be a valid UUID').optional(),
    }),
});

export const updateTicketSchema = yup.object({
    body: yup.object({
        title: yup.string().min(5, 'Title must be at least 5 characters long'),
        description: yup.string().min(10, 'Description must be at least 10 characters long'),
        statusId: yup.string(),
        priority: yup.string().oneOf(['Low', 'Medium', 'High'], 'Priority must be one of: Low, Medium, or High'),
        assigneeId: yup.string().uuid('Assignee ID must be a valid UUID').nullable(),
    }).test(
        'at-least-one-field',
        'At least one field (title, description, statusId, priority, assigneeId) must be provided for an update.',
        (value) => value.title !== undefined || value.description !== undefined || value.statusId !== undefined || value.priority !== undefined || value.assigneeId !== undefined
    ),
    params: yup.object({
        id: yup.string().uuid('Invalid ticket ID format.').required('Ticket ID is required'),
    }),
});

export const ticketIdParamsSchema = yup.object({
    params: yup.object({
        id: yup.string().uuid('Invalid ticket ID format.').required('Ticket ID is required'),
    }),
});

export const createApprovalSchema = yup.object({
    body: yup.object({
        comment: yup.string().optional().max(500, 'Comment cannot exceed 500 characters'),
        status: yup.string().oneOf(['Approved', 'Rejected'], 'Status must be either Approved or Rejected').required('Status is required'),
    }),
    params: yup.object({
        id: yup.string().uuid('Invalid ticket ID format.').required('Ticket ID is required'),
    }),
});