import * as yup from 'yup';

// Schema for user creation
export const createUserSchema = yup.object({
    body: yup.object({
        name: yup.string().required('Name is required'),
        email: yup.string().email('Must be a valid email').required('Email is required'),
        password: yup.string().required('Password is required').min(8, 'Password must be at least 8 characters'),
        roleId: yup.string().uuid('Invalid Role ID format').required('Role ID is required'),
    }),
});

// Schema for user login
export const loginSchema = yup.object({
    body: yup.object({
        email: yup.string().email('Must be a valid email').required('Email is required'),
        password: yup.string().required('Password is required'),
    }),
});

// Schema for updating a user
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

// Schema for validating just the user ID in params
export const userIdParamsSchema = yup.object({
    params: yup.object({
        id: yup.string().uuid('Invalid user ID format').required('User ID is required'),
    }),
});