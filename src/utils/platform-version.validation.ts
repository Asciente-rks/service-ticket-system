import * as yup from 'yup';

const platformField = yup
  .string()
  .trim()
  .max(60, 'Platform is too long (max 60 characters)');

const versionField = yup
  .string()
  .trim()
  .max(60, 'Version is too long (max 60 characters)');

export const collectionIdParamSchema = yup.object({
  params: yup.object({
    collectionId: yup.string().uuid('Invalid collection id').required('Collection id is required'),
  }),
});

export const createPlatformVersionSchema = yup.object({
  body: yup.object({
    platform: platformField.required('Platform is required'),
    version: versionField.required('Version is required'),
  }),
  params: yup.object({
    collectionId: yup.string().uuid('Invalid collection id').required('Collection id is required'),
  }),
});

export const updatePlatformVersionSchema = yup.object({
  body: yup
    .object({
      platform: platformField,
      version: versionField,
    })
    .test(
      'at-least-one-field',
      'Provide a platform or version to update.',
      (value) => value.platform !== undefined || value.version !== undefined,
    ),
  params: yup.object({
    collectionId: yup.string().uuid('Invalid collection id').required('Collection id is required'),
    id: yup.string().uuid('Invalid platform/version id').required('Platform/version id is required'),
  }),
});

export const platformVersionIdParamsSchema = yup.object({
  params: yup.object({
    collectionId: yup.string().uuid('Invalid collection id').required('Collection id is required'),
    id: yup.string().uuid('Invalid platform/version id').required('Platform/version id is required'),
  }),
});
