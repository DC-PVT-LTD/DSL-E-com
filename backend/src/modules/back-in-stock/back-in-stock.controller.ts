import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BackInStockService } from './back-in-stock.service';
import {
  subscribeBackInStockSchema,
  SubscribeBackInStockDto,
} from './dto/back-in-stock.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Back In Stock Alerts')
@Controller('back-in-stock')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearerAuth')
export class BackInStockController {
  constructor(
    @Inject(BackInStockService)
    private readonly backInStockService: BackInStockService
  ) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to back-in-stock alerts for an out-of-stock product' })
  @ApiResponse({ status: 200, description: 'Subscribed to back-in-stock alert successfully' })
  @ApiResponse({ status: 400, description: 'Product is currently in stock' })
  @ApiResponse({ status: 404, description: 'Product not found or inactive' })
  async subscribe(
    @Body(createZodPipe(subscribeBackInStockSchema)) dto: SubscribeBackInStockDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const result = await this.backInStockService.subscribe(user.id, dto.productId);
    return createApiResponse(result, result.message || 'Subscription processed successfully');
  }

  @Get('my-alerts')
  @ApiOperation({ summary: 'Get all back-in-stock alert subscriptions for the authenticated customer' })
  @ApiResponse({ status: 200, description: 'Customer alert subscriptions returned' })
  async getMyAlerts(@CurrentUser() user: AuthenticatedUser) {
    const alerts = await this.backInStockService.getMyAlerts(user.id);
    return createApiResponse(alerts, 'Alert subscriptions retrieved successfully');
  }

  @Delete(':alertId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an active back-in-stock alert subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden if alert belongs to another customer' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async cancelAlert(
    @Param('alertId') alertId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const result = await this.backInStockService.cancelAlert(user.id, alertId);
    return createApiResponse(result, result.message);
  }

  @Get('status/:productId')
  @ApiOperation({ summary: 'Check if authenticated customer is subscribed to a product' })
  @ApiResponse({ status: 200, description: 'Subscription status returned' })
  async getStatus(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const status = await this.backInStockService.getStatus(user.id, productId);
    return createApiResponse(status, 'Subscription status retrieved successfully');
  }

  @Post('recover-stale')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recover stale PROCESSING back-in-stock alert leases' })
  @ApiResponse({ status: 200, description: 'Stale alerts recovered successfully' })
  async recoverStaleAlerts() {
    const result = await this.backInStockService.recoverStaleAlerts();
    return createApiResponse(result, 'Stale alerts recovery cycle completed');
  }
}

