import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import {
  querySubscribersSchema,
  QuerySubscribersDto,
} from './dto/newsletter.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Newsletter (Admin)')
@Controller('admin/newsletter')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth('bearerAuth')
export class AdminNewsletterController {
  constructor(
    @Inject(NewsletterService)
    private readonly newsletterService: NewsletterService
  ) {}

  @Get('subscribers')
  @ApiOperation({ summary: 'List newsletter subscribers with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Subscribers returned' })
  async getSubscribers(
    @Query(createZodPipe(querySubscribersSchema)) query: QuerySubscribersDto
  ) {
    const data = await this.newsletterService.getAdminSubscribers(query);
    return createApiResponse(data, 'Subscribers retrieved successfully');
  }

  @Get('export')
  @ApiOperation({ summary: 'Export eligible marketing subscribers to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportCsv(@Res() res: Response) {
    const csvData = await this.newsletterService.exportEligibleSubscribersCsv();
    const filename = `dsl-subscribers-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvData);
  }

  @Get('subscribers/:id')
  @ApiOperation({ summary: 'Get subscriber details' })
  @ApiResponse({ status: 200, description: 'Subscriber details returned' })
  @ApiResponse({ status: 404, description: 'Subscriber not found' })
  async getSubscriberById(@Param('id') id: string) {
    const subscriber = await this.newsletterService.getAdminSubscriberById(id);
    return createApiResponse(subscriber, 'Subscriber retrieved successfully');
  }

  @Get('subscribers/:id/consent-history')
  @ApiOperation({ summary: 'Get subscriber consent audit history' })
  @ApiResponse({ status: 200, description: 'Consent history returned' })
  @ApiResponse({ status: 404, description: 'Subscriber not found' })
  async getConsentHistory(@Param('id') id: string) {
    const history = await this.newsletterService.getAdminConsentHistory(id);
    return createApiResponse(history, 'Consent history retrieved successfully');
  }
}

