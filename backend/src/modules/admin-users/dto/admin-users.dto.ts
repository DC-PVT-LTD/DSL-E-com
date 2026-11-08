import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma';

export const createAdminUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name cannot exceed 100 characters'),
  phone: z.string().trim().max(30).optional().nullable(),
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF], {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' }),
  }),
  roleId: z.string().min(1, 'roleId is required').optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export class CreateAdminUserDto {
  @ApiProperty({ description: 'Administrator email address', example: 'kamal.p@dslstationery.lk' })
  email: string;

  @ApiProperty({ description: 'Full name', example: 'Kamal Perera' })
  name: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+94771234567' })
  phone?: string | null;

  @ApiProperty({ description: 'Administrative role', enum: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF], example: UserRole.STAFF })
  role: UserRole;

  @ApiPropertyOptional({ description: 'Dynamic role ID' })
  roleId?: string;

  @ApiProperty({ description: 'Initial account password', example: 'StaffSecurePass123!' })
  password: string;
}

export const inviteAdminUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name cannot exceed 100 characters'),
  phone: z.string().trim().max(30).optional().nullable(),
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF], {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' }),
  }),
  roleId: z.string().min(1, 'roleId is required').optional(),
});

export class InviteAdminUserDto {
  @ApiProperty({ description: 'Invited administrator email address', example: 'anura.s@dslstationery.lk' })
  email: string;

  @ApiProperty({ description: 'Full name', example: 'Anura Silva' })
  name: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+94779876543' })
  phone?: string | null;

  @ApiProperty({ description: 'Assigned administrative role', enum: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF], example: UserRole.STAFF })
  role: UserRole;

  @ApiPropertyOptional({ description: 'Dynamic role ID' })
  roleId?: string;
}

export const adminUserQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class AdminUserQueryDto {
  @ApiPropertyOptional({ description: 'Search query for name, email, or phone' })
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by administrative role', enum: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] })
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Filter by active status (true/false)' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  limit?: number;
}

export const updateAdminStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status is required' }),
});

export class UpdateAdminStatusDto {
  @ApiProperty({ description: 'New active status', example: false })
  isActive: boolean;
}

export const updateAdminRoleSchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF], {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' }),
  }),
  roleId: z.string().min(1, 'roleId is required').optional(),
});

export class UpdateAdminRoleDto {
  @ApiProperty({ description: 'New administrative role', enum: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF], example: UserRole.MANAGER })
  role: UserRole;

  @ApiPropertyOptional({ description: 'New dynamic role ID' })
  roleId?: string;
}

