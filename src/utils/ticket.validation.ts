import * as yup from 'yup';

// Optional Jam (jam.dev) recording link. Empty string is treated as "not set".
const jamUrlSchema = yup
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .url('Jam recording must be a valid URL (e.g. https://jam.dev/c/...)')
    .nullable()
    .notRequired();

// Title/description have no minimum or maximum length — users decide how much or
// how little to write. Title is still required to be present (non-empty).
// Up to 20 assignees per ticket, each a valid UUID. Accepts an empty array.
const assigneeIdsSchema = yup
    .array()
    .of(yup.string().uuid('Each assignee ID must be a valid UUID').required())
    .max(20, 'A ticket can have at most 20 assignees')
    .optional();

// Up to 20 platform/versions per ticket, each a valid UUID.
const platformVersionIdsSchema = yup
    .array()
    .of(yup.string().uuid('Each platform/version ID must be a valid UUID').required())
    .max(20, 'A ticket can have at most 20 platform/versions')
    .optional();

export const createTicketSchema = yup.object({
    body: yup.object({
        title: yup.string().trim().required('Title is required'),
        description: yup.string().trim().required('Description is required'),
        priority: yup.string().oneOf(['Low', 'Medium', 'High'], 'Priority must be one of: Low, Medium, or High').optional(),
        assigneeId: yup.string().uuid('Assignee ID must be a valid UUID').optional(),
        assigneeIds: assigneeIdsSchema,
        platformVersionId: yup.string().uuid('Platform/version ID must be a valid UUID').nullable().notRequired(),
        platformVersionIds: platformVersionIdsSchema,
        collectionId: yup.string().uuid('Collection ID must be a valid UUID').optional(),
        jamUrl: jamUrlSchema,
    }),
});

export const updateTicketSchema = yup.object({
    body: yup.object({
        title: yup.string().trim(),
        description: yup.string().trim(),
        statusId: yup.string(),
        priority: yup.string().oneOf(['Low', 'Medium', 'High'], 'Priority must be one of: Low, Medium, or High'),
        assigneeId: yup.string().uuid('Assignee ID must be a valid UUID').nullable(),
        assigneeIds: assigneeIdsSchema,
        platformVersionId: yup.string().uuid('Platform/version ID must be a valid UUID').nullable(),
        platformVersionIds: platformVersionIdsSchema,
        collectionId: yup.string().uuid('Collection ID must be a valid UUID'),
        jamUrl: jamUrlSchema,
    }).test(
        'at-least-one-field',
        'At least one field (title, description, statusId, priority, assigneeId, assigneeIds, platformVersionId, platformVersionIds, collectionId, jamUrl) must be provided for an update.',
        (value) => value.title !== undefined || value.description !== undefined || value.statusId !== undefined || value.priority !== undefined || value.assigneeId !== undefined || (value as any).assigneeIds !== undefined || (value as any).platformVersionId !== undefined || (value as any).platformVersionIds !== undefined || (value as any).collectionId !== undefined || value.jamUrl !== undefined
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

export const createCommentSchema = yup.object({
    body: yup.object({
        body: yup.string().trim().required('Comment cannot be empty').max(5000, 'Comment is too long (max 5000 characters)'),
        parentId: yup.string().uuid('Invalid parent comment id').nullable().notRequired(),
    }),
    params: yup.object({
        id: yup.string().uuid('Invalid ticket ID format.').required('Ticket ID is required'),
    }),
});