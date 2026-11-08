import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9_-]+$/, {
    message: 'Slug must contain only lowercase alphanumeric characters, dashes, or underscores',
  }),
  description: z.string().max(500).optional(),
  permissionKeys: z.array(z.string()).default([]),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export const assignRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()).min(0),
});

export type AssignRolePermissionsDto = z.infer<typeof assignRolePermissionsSchema>;

