import * as yup from 'yup';

export const createCollectionSchema = yup.object({
  body: yup.object({
    name: yup
      .string()
      .trim()
      .required('Collection name is required')
      .max(120, 'Collection name is too long (max 120 characters)'),
    description: yup
      .string()
      .trim()
      .max(500, 'Description is too long (max 500 characters)')
      .nullable()
      .notRequired(),
  }),
});

export const updateCollectionSchema = yup.object({
  body: yup
    .object({
      name: yup.string().trim().max(120, 'Collection name is too long (max 120 characters)'),
      description: yup
        .string()
        .trim()
        .max(500, 'Description is too long (max 500 characters)')
        .nullable(),
    })
    .test(
      'at-least-one-field',
      'Provide a name or description to update.',
      (value) => value.name !== undefined || value.description !== undefined,
    ),
  params: yup.object({
    id: yup.string().uuid('Invalid collection id').required('Collection id is required'),
  }),
});

export const collectionIdParamsSchema = yup.object({
  params: yup.object({
    id: yup.string().uuid('Invalid collection id').required('Collection id is required'),
  }),
});
