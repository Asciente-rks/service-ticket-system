import * as yup from 'yup';

export const updateNotificationSettingsSchema = yup.object({
    body: yup.object({
        notifyAssignedTicket: yup.boolean().optional(),
        notifyReportedTicket: yup.boolean().optional(),
        notifyTicketApproved: yup.boolean().optional(),
        notifyTicketRejected: yup.boolean().optional(),
    }).test(
        'at-least-one-field',
        'At least one notification setting must be provided for an update.',
        (value) => 
            value.notifyAssignedTicket !== undefined ||
            value.notifyReportedTicket !== undefined ||
            value.notifyTicketApproved !== undefined ||
            value.notifyTicketRejected !== undefined
    ),
});

export const listNotificationsSchema = yup.object({
    query: yup.object({
        page: yup.number().integer('Page must be an integer').min(1, 'Page must be at least 1').optional(),
        limit: yup.number().integer('Limit must be an integer').min(1, 'Limit must be at least 1').optional(),
        read: yup.boolean().optional()
    })
});