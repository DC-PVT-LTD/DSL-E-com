import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { StoreSettingsService } from './store-settings.service';
import { ConfirmationService } from '../security/confirmation.service';
import {
  UpdateBankTransferSettingsDto,
  PublicStoreSettingsResponse,
  AdminStoreSettingsResponse,
} from './dto/store-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Store Settings')
@Controller('store-settings')
export class StoreSettingsController {
  constructor(
    @Inject(StoreSettingsService) private readonly storeSettingsService: StoreSettingsService,
    @Inject(ConfirmationService) private readonly confirmationService: ConfirmationService,
  ) { }

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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('settings.view')
  @ApiCookieAuth('dsl_access_token')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Retrieve full store settings for administrative configuration',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Complete store settings with configuration status',
  })
  async getAdminSettings(@Req() req: any): Promise<AdminStoreSettingsResponse> {
    return this.storeSettingsService.getAdminSettings(req.user);
  }

  @Put('admin/bank-transfer')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('settings.financial')
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

    await this.confirmationService.validateConfirmation({
      action: 'CONFIRM_FINANCIAL_SETTINGS',
      req,
      targetEntity: 'StoreSettings',
      targetId: 'default',
      expectedValue: 'CONFIRM FINANCIAL SETTINGS',
      actor: {
        id: adminUserId,
        email: req.user?.email,
        name: req.user?.name,
        roleSlug: req.user?.assignedRole?.slug || req.user?.roleSlug,
      },
    });

    return this.storeSettingsService.updateBankTransferSettings(dto, adminUserId);
  }
}

