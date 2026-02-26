import { Request, Response, NextFunction } from 'express';
import { AnySchema, ValidationError } from 'yup';

export const validate = (schema: AnySchema) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validatedData = await schema.validate({
            body: req.body,
            query: req.query,
            params: req.params,
        }, { abortEarly: false, stripUnknown: true });

        if (validatedData.body) req.body = validatedData.body;
        if (validatedData.params) req.params = validatedData.params;
        if (validatedData.query) req.query = validatedData.query;

        return next();
    } catch (error: any) {
        if (error instanceof ValidationError) {
            return res.status(400).json({
                type: 'ValidationError',
                message: 'Input validation failed',
                errors: error.inner.map(e => ({ path: e.path, message: e.message })),
            });
        }
        return res.status(500).json({ message: 'An unexpected error occurred during validation.' });
    }
};