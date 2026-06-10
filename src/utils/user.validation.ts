import * as yup from 'yup';

export const createUserSchema = yup.object({
    body: yup.object({
        name: yup.string().required('Name is required'),
        email: yup.string().email('Must be a valid email').required('Email is required'),
        password: yup.string().required('Password is required').min(8, 'Password must be at least 8 characters'),
        roleId: yup.string().uuid('Invalid Role ID format').required('Role ID is required'),
    }),
});

export const loginSchema = yup.object({
    body: yup.object({
        email: yup.string().email('Must be a valid email').required('Email is required'),
        password: yup.string().required('Password is required'),
    }),
});

export const registerSchema = yup.object({
    body: yup.object({
        email: yup.string().email('Must be a valid email').required('Email is required'),
    }),
});

export const verifyOtpSchema = yup.object({
    body: yup.object({
        email: yup.string().email('Must be a valid email').required('Email is required'),
        code: yup.string().trim().length(6, 'Code must be 6 digits').required('Code is required'),
    }),
});

export const setPasswordSchema = yup.object({
    body: yup.object({
        registrationToken: yup.string().required('Registration token is required'),
        name: yup.string().trim().min(2, 'Name must be at least 2 characters').required('Name is required'),
        password: yup.string().required('Password is required').min(8, 'Password must be at least 8 characters'),
    }),
});

export const forgotPasswordSchema = yup.object({
    body: yup.object({
        email: yup.string().email('Must be a valid email').required('Email is required'),
    }),
});

export const verifyResetOtpSchema = yup.object({
    body: yup.object({
        email: yup.string().email('Must be a valid email').required('Email is required'),
        code: yup.string().trim().length(6, 'Code must be 6 digits').required('Code is required'),
    }),
});

export const resetPasswordSchema = yup.object({
    body: yup.object({
        resetToken: yup.string().required('Reset token is required'),
        password: yup.string().required('Password is required').min(8, 'Password must be at least 8 characters'),
    }),
});

export const changePasswordSchema = yup.object({
    body: yup.object({
        currentPassword: yup.string().required('Current password is required'),
        newPassword: yup.string().required('New password is required').min(8, 'New password must be at least 8 characters'),
    }),
});

export const updateProfileSchema = yup.object({
    body: yup.object({
        currentPassword: yup.string().required('Current password is required to change your profile'),
        name: yup.string().trim().min(1, 'Name cannot be empty'),
        email: yup.string().email('Must be a valid email'),
    }).test(
        'at-least-one-field',
        'Provide a new name or email to update.',
        (value) => value.name !== undefined || value.email !== undefined,
    ),
});

export const createOrganizationSchema = yup.object({
    body: yup.object({
        name: yup.string().trim().min(2, 'Organization name must be at least 2 characters').required('Organization name is required'),
    }),
});

export const updateOrganizationSchema = yup.object({
    body: yup.object({
        name: yup.string().trim().min(2, 'Organization name must be at least 2 characters').required('Organization name is required'),
    }),
});

export const joinOrganizationSchema = yup.object({
    body: yup.object({
        inviteCode: yup.string().trim().required('Invite code is required'),
    }),
});

export const updateUserSchema = yup.object({
    body: yup.object({
        name: yup.string(),
        email: yup.string().email('Must be a valid email'),
        password: yup.string().min(8, 'Password must be at least 8 characters'),
        roleId: yup.string().uuid('Invalid Role ID format'),
    }).test(
        'at-least-one-field',
        'At least one field (name, email, password, roleId) must be provided for an update.',
        (value) => !!(value.name || value.email || value.password || value.roleId)
    ),
    params: yup.object({
        id: yup.string().uuid('Invalid user ID format').required('User ID is required'),
    }),
});

export const userIdParamsSchema = yup.object({
    params: yup.object({
        id: yup.string().uuid('Invalid user ID format').required('User ID is required'),
    }),
});