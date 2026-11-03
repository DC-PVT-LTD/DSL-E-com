import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+94|0)[0-9]{9}$/, 'Phone number must be a valid Sri Lankan phone number (e.g., +94771234567 or 0771234567)')
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+94|0)[0-9]{9}$/, 'Phone number must be a valid Sri Lankan phone number')
    .optional(),
});

export const createAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  phone: z.string().trim().min(9, 'Phone number is required'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  addressLine1: z.string().trim().min(3, 'Address line 1 is required'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  district: z.string().trim().min(2, 'District is required'),
  postalCode: z.string().trim().optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export class RegisterDto {
  @ApiProperty({
    description: 'Full customer name (min 2, max 100 characters)',
    example: 'Nimesha Perera',
    minLength: 2,
    maxLength: 100,
  })
  name: string;

  @ApiProperty({
    description: 'Valid unique email address',
    example: 'nimesha.p@example.lk',
  })
  email: string;

  @ApiProperty({
    description:
      'Account password (min 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number)',
    example: 'SecurePassword123!',
    minLength: 8,
    maxLength: 128,
  })
  password: string;

  @ApiPropertyOptional({
    description: 'Sri Lankan contact phone number (+9477... or 077...)',
    example: '+94771234567',
  })
  phone?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Registered customer or administrator email address',
    example: 'customer@example.lk',
  })
  email: string;

  @ApiProperty({
    description: 'Account password',
    example: 'Password123!',
  })
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Registered email address to request password reset',
    example: 'customer@example.lk',
  })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Single-use password reset token received via link',
    example: '5f4dcc3b5aa765d61d8327deb882cf992b9599b4526549206b00b71234567890',
  })
  token: string;

  @ApiProperty({
    description:
      'New password (min 8 characters, at least 1 uppercase, 1 lowercase, 1 number)',
    example: 'NewSecurePassword123!',
    minLength: 8,
    maxLength: 128,
  })
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Updated customer full name',
    example: 'Nimesha K. Perera',
    minLength: 2,
    maxLength: 100,
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated Sri Lankan contact phone number',
    example: '+94779876543',
  })
  phone?: string;
}

export class CreateAddressDto {
  @ApiProperty({
    description: 'Recipient full name',
    example: 'Nimesha Perera',
    minLength: 2,
  })
  fullName: string;

  @ApiProperty({
    description: 'Delivery contact phone number',
    example: '+94771234567',
    minLength: 9,
  })
  phone: string;

  @ApiProperty({
    description: 'Notification email address for deliveries',
    example: 'nimesha.p@example.lk',
  })
  email: string;

  @ApiProperty({
    description: 'Street address line 1 (House number, street name)',
    example: 'No. 45 Galle Road',
    minLength: 3,
  })
  addressLine1: string;

  @ApiPropertyOptional({
    description: 'Street address line 2 (Apartment, floor, unit)',
    example: 'Apt 3B, Ocean View Towers',
  })
  addressLine2?: string;

  @ApiProperty({
    description: 'City or town',
    example: 'Colombo 03',
    minLength: 2,
  })
  city: string;

  @ApiProperty({
    description: 'Administrative district in Sri Lanka',
    example: 'Colombo',
    minLength: 2,
  })
  district: string;

  @ApiPropertyOptional({
    description: 'Postal / PIN code',
    example: '00300',
  })
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Set as primary / default delivery address',
    example: true,
    default: false,
  })
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) { }

