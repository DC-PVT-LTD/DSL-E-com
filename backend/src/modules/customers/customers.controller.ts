import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Req,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { UserRole } from '../../generated/prisma';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  customerQuerySchema,
  CustomerQueryDto,
  updateCustomerStatusSchema,
  UpdateCustomerStatusDto,
} from './dto/customer-query.dto';

@ApiTags('Admin API', 'Customers')
@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
@ApiCookieAuth('dsl_access_token')
@ApiBearerAuth('bearerAuth')
export class CustomersController {
  constructor(
    @Inject(CustomersService) private readonly customersService: CustomersService
  ) { }

  @Get()
  @RequirePermissions('customers.view')
  @ApiOperation({
    summary: 'List customer accounts',
    description: 'Retrieves all registered customer accounts with search, status filters, and pagination.',
  })
  @ApiResponse({ status: 200, description: 'Paginated customer accounts' })
  async findAll(@Query(createZodPipe(customerQuerySchema)) query: CustomerQueryDto) {
    const result = await this.customersService.findAll(query);
    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
      message: 'Customers retrieved successfully',
    };
  }

  @Get('analytics')
  @RequirePermissions('customers.view')
  @ApiOperation({
    summary: 'Get customer analytics',
    description: 'Returns real database metrics on customer accounts, activity, and geographic distribution.',
  })
  @ApiResponse({ status: 200, description: 'Customer analytics data' })
  async getAnalytics() {
    const data = await this.customersService.getAnalytics();
    return {
      success: true,
      data,
      message: 'Customer analytics retrieved successfully',
    };
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('customers.view')
  @ApiOperation({
    summary: 'Export customers to CSV or Excel',
    description: 'Exports matching customers across active filters or selected IDs to a formatted CSV or XLSX file.',
  })
  async exportCustomers(
    @Query(createZodPipe(customerQuerySchema)) query: CustomerQueryDto,
    @Query('format') format: 'csv' | 'xlsx',
    @Query('selectedIds') selectedIdsStr: string,
    @Res() res: Response
  ) {
    const selectedIds = selectedIdsStr ? selectedIdsStr.split(',').filter(Boolean) : undefined;
    const file = await this.customersService.exportCustomers(query, format || 'xlsx', selectedIds);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  @ApiOperation({
    summary: 'Get customer profile details',
    description: 'Retrieves complete profile, saved addresses, and order history for a specific customer.',
  })
  @ApiParam({ name: 'id', description: 'Customer User ID or Guest ID' })
  @ApiResponse({ status: 200, description: 'Customer detail record' })
  async findById(@Param('id') id: string) {
    const data = await this.customersService.findById(id);
    return {
      success: true,
      data,
      message: 'Customer details retrieved successfully',
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('customers.manage')
  @ApiOperation({
    summary: 'Update customer account status',
    description: 'Activates or suspends a customer account with reason tracking in audit logs.',
  })
  @ApiParam({ name: 'id', description: 'Customer User ID' })
  async updateStatus(
    @Param('id') id: string,
    @Body(createZodPipe(updateCustomerStatusSchema)) dto: UpdateCustomerStatusDto,
    @Req() req: any
  ) {
    const actorId = req.user?.id || null;
    const data = await this.customersService.updateStatus(id, dto, actorId);
    return {
      success: true,
      data,
      message: `Customer account status updated to ${dto.isActive ? 'Active' : 'Suspended'}`,
    };
  }
}

