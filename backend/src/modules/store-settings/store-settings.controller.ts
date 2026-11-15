import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { StoreSettingsService } from './store-settings.service';
import {
  UpdateBankTransferSettingsDto,
  PublicStoreSettingsResponse,
  AdminStoreSettingsResponse,
} from './dto/store-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Store Settings')
@Controller('store-settings')
export class StoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get('public')
  @ApiOperation({
    summary: 'Retrieve customer-facing store settings and active payment methods',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active payment methods and sanitized bank instructions',
  })
  async getPublicSettings(): Promise<PublicStoreSettingsResponse> {
    return this.storeSettingsService.getPublicSettings();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Retrieve full store settings for administrative configuration',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Complete store settings with configuration status',
  })
  async getAdminSettings(): Promise<AdminStoreSettingsResponse> {
    return this.storeSettingsService.getAdminSettings();
  }

  @Put('admin/bank-transfer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Update bank transfer store settings and instructions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bank transfer settings updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed or missing required fields when enabling',
  })
  async updateBankTransfer(
    @Body() dto: UpdateBankTransferSettingsDto,
    @Req() req: any,
  ): Promise<AdminStoreSettingsResponse> {
    const adminUserId = req.user?.id || req.user?.sub || 'system-admin';
    return this.storeSettingsService.updateBankTransferSettings(dto, adminUserId);
  }
}

