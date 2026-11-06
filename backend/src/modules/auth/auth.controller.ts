import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Req,
  Res,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  verifyEmailSchema,
  resendVerificationOtpSchema,
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
  VerifyEmailDto,
  ResendVerificationOtpDto,
} from './dto/auth.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @ApiTags('Authentication')
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register customer account',
    description:
      'Creates a new customer account with role CUSTOMER, hashes the password with bcrypt (12 rounds), ' +
      'and automatically sets HttpOnly authentication session cookies (dsl_access_token and dsl_refresh_token).',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Account registered successfully with session cookies set',
    schema: {
      example: {
        success: true,
        message: 'Account registered successfully',
        data: {
          id: 'cmw01abc10000pous00010001',
          email: 'nimesha.p@example.lk',
          name: 'Nimesha Perera',
          phone: '+94771234567',
          role: 'CUSTOMER',
          createdAt: '2026-11-03T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed (e.g. password too weak, invalid email)' })
  @ApiResponse({ status: 409, description: 'An account with this email address already exists' })
  @ApiResponse({ status: 429, description: 'Too Many Requests (Rate limit: 10 attempts per minute)' })
  async register(
    @Body(createZodPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.register(dto, res);
  }

  @ApiTags('Authentication')
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify email ownership via OTP and link eligible guest orders',
    description:
      'Validates 6-digit OTP, marks user account as verified, securely links eligible guest orders, ' +
      'and issues HttpOnly authentication session cookies.',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified and session established' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async verifyEmail(
    @Body(createZodPipe(verifyEmailSchema)) dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.verifyEmail(dto, res);
  }

  @ApiTags('Authentication')
  @Post('resend-verification-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Resend 6-digit email verification code with rate limiting cooldown',
  })
  @ApiBody({ type: ResendVerificationOtpDto })
  @ApiResponse({ status: 200, description: 'New verification code dispatched if account eligible' })
  @ApiResponse({ status: 400, description: 'Cooldown period active or account already verified' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async resendVerificationOtp(
    @Body(createZodPipe(resendVerificationOtpSchema)) dto: ResendVerificationOtpDto
  ) {
    return this.authService.resendVerificationOtp(dto);
  }

  @ApiTags('Authentication')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Customer or administrator login',
    description:
      'Authenticates user with email and password. Checks active status and failed login lockout. ' +
      'Issues dsl_access_token (15m TTL) and dsl_refresh_token (7d TTL) in HttpOnly cookies.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Logged in successfully with session cookies set',
    schema: {
      example: {
        success: true,
        message: 'Logged in successfully',
        data: {
          id: 'cmw01abc10000pous00010001',
          email: 'customer@example.lk',
          name: 'Nimesha Perera',
          role: 'CUSTOMER',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error (missing email or password)' })
  @ApiResponse({ status: 401, description: 'Invalid credentials, account deactivated, or account temporarily locked' })
  @ApiResponse({ status: 429, description: 'Too Many Requests (Rate limit: 5 attempts per minute)' })
  async login(
    @Body(createZodPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    return this.authService.login(dto, res);
  }

  @ApiTags('Authentication')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Rotate session tokens',
    description:
      'Rotates the active session using the HttpOnly dsl_refresh_token cookie. Invalidates the old refresh token ' +
      'and issues a fresh token pair. Replaying a revoked token triggers automatic session termination across all devices.',
  })
  @ApiCookieAuth('dsl_refresh_token')
  @ApiResponse({
    status: 200,
    description: 'Tokens rotated successfully; new cookies set',
    schema: {
      example: {
        success: true,
        message: 'Tokens rotated successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token missing, expired, or reuse detected' })
  @ApiResponse({ status: 429, description: 'Too Many Requests (Rate limit: 20 per minute)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const rawRefreshToken = req.cookies?.['dsl_refresh_token'];
    return this.authService.refreshTokens(rawRefreshToken, res);
  }

  @ApiTags('Authentication')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign out and revoke session',
    description:
      'Revokes the active refresh token session in the database and clears dsl_access_token and dsl_refresh_token cookies (Max-Age=0).',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully; cookies cleared',
    schema: {
      example: {
        success: true,
        message: 'Logged out successfully',
      },
    },
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const rawRefreshToken = req.cookies?.['dsl_refresh_token'];
    const user = req.user as AuthenticatedUser | undefined;
    return this.authService.logout(user?.id, rawRefreshToken, res);
  }

  @ApiTags('Customer API')
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get authenticated user profile',
    description: 'Retrieves current user identity, role, and verification status from the verified session.',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiResponse({
    status: 200,
    description: 'Authenticated user profile data',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cmw01abc10000pous00010001',
          email: 'customer@example.lk',
          name: 'Nimesha Perera',
          phone: '+94771234567',
          role: 'CUSTOMER',
          isActive: true,
          createdAt: '2026-11-03T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — valid session cookie or Bearer token required' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @ApiTags('Authentication')
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Initiates password reset flow. Generates a 256-bit cryptographically secure reset token with 1-hour expiration. ' +
      'In development mode only, logs the reset URL to backend console. Always returns a generic response to prevent account enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Generic confirmation message returned regardless of whether the email exists',
    schema: {
      example: {
        success: true,
        message: 'If this email is registered, a password reset link will be sent.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid email address format' })
  @ApiResponse({ status: 429, description: 'Too Many Requests (Rate limit: 3 attempts per 15 minutes)' })
  async forgotPassword(
    @Body(createZodPipe(forgotPasswordSchema)) dto: ForgotPasswordDto
  ) {
    return this.authService.forgotPassword(dto);
  }

  @ApiTags('Authentication')
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Complete password reset',
    description:
      'Verifies the single-use reset token hash, updates the password hash with bcrypt, resets lockout counters, ' +
      'and invalidates all existing refresh sessions.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    schema: {
      example: {
        success: true,
        message: 'Password has been reset successfully. Please sign in with your new password.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired password reset token, or password complexity requirements not met' })
  @ApiResponse({ status: 429, description: 'Too Many Requests (Rate limit: 5 attempts per minute)' })
  async resetPassword(
    @Body(createZodPipe(resetPasswordSchema)) dto: ResetPasswordDto
  ) {
    return this.authService.resetPassword(dto);
  }

  // --------------------------------------------------------------------------
  // Customer Account Operations (Part D)
  // --------------------------------------------------------------------------

  @ApiTags('Customer API')
  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update customer profile',
    description: 'Updates personal information (name, phone) for the currently authenticated user.',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: 'cmw01abc10000pous00010001',
          email: 'customer@example.lk',
          name: 'Nimesha K. Perera',
          phone: '+94779876543',
          role: 'CUSTOMER',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'CSRF validation failed on cookie-authenticated request' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body(createZodPipe(updateProfileSchema)) dto: UpdateProfileDto
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  @ApiTags('Customer API')
  @Get('me/addresses')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get saved delivery addresses',
    description: 'Retrieves all delivery addresses saved by the authenticated customer, sorted with default address first.',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiResponse({
    status: 200,
    description: 'List of saved delivery addresses',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'addr-01',
            fullName: 'Nimesha Perera',
            phone: '+94771234567',
            email: 'nimesha.p@example.lk',
            addressLine1: 'No. 45 Galle Road',
            addressLine2: 'Apt 3B',
            city: 'Colombo 03',
            district: 'Colombo',
            postalCode: '00300',
            isDefault: true,
            createdAt: '2026-11-03T10:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getAddresses(@CurrentUser('id') userId: string) {
    return this.authService.getAddresses(userId);
  }

  @ApiTags('Customer API')
  @Post('me/addresses')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create saved delivery address',
    description: 'Adds a new delivery address for the authenticated customer. If isDefault is true, unsets any existing default address.',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully',
    schema: {
      example: {
        success: true,
        message: 'Address created successfully',
        data: {
          id: 'addr-02',
          fullName: 'Nimesha Perera',
          phone: '+94771234567',
          email: 'nimesha.p@example.lk',
          addressLine1: 'No. 120 Kandy Road',
          city: 'Kadawatha',
          district: 'Gampaha',
          isDefault: false,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'CSRF validation failed on cookie-authenticated request' })
  async createAddress(
    @CurrentUser('id') userId: string,
    @Body(createZodPipe(createAddressSchema)) dto: CreateAddressDto
  ) {
    return this.authService.createAddress(userId, dto);
  }

  @ApiTags('Customer API')
  @Put('me/addresses/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update delivery address',
    description: 'Updates a saved delivery address. Server strictly verifies that the address belongs to the authenticated user.',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiParam({ name: 'id', description: 'Address UUID' })
  @ApiBody({ type: UpdateAddressDto })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Address not found or not owned by authenticated user' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'CSRF validation failed on cookie-authenticated request' })
  async updateAddress(
    @CurrentUser('id') userId: string,
    @Param('id') addressId: string,
    @Body(createZodPipe(updateAddressSchema)) dto: UpdateAddressDto
  ) {
    return this.authService.updateAddress(userId, addressId, dto);
  }

  @ApiTags('Customer API')
  @Delete('me/addresses/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete delivery address',
    description: 'Deletes a saved delivery address. Server strictly verifies that the address belongs to the authenticated user.',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiParam({ name: 'id', description: 'Address UUID' })
  @ApiResponse({
    status: 200,
    description: 'Address deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Address deleted successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Address not found or not owned by authenticated user' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'CSRF validation failed on cookie-authenticated request' })
  async deleteAddress(
    @CurrentUser('id') userId: string,
    @Param('id') addressId: string
  ) {
    return this.authService.deleteAddress(userId, addressId);
  }

  @ApiTags('Customer API')
  @Get('me/orders')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get customer order history',
    description: 'Retrieves all past and active orders for the authenticated customer with order items and delivery snapshots.',
  })
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiResponse({
    status: 200,
    description: 'Customer orders list',
    schema: {
      example: {
        success: true,
        data: [],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getMyOrders(@CurrentUser('id') userId: string) {
    return this.authService.getMyOrders(userId);
  }
}

