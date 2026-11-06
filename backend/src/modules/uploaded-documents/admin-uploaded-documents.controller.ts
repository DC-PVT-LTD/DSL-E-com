import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UploadedDocumentsService } from './uploaded-documents.service';
import { UpdateExtractedItemDto } from './dto/update-extracted-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole, DocumentStatus } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Admin API', 'Uploaded Documents')
@Controller('admin/uploaded-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth('jwt-bearer')
export class AdminUploadedDocumentsController {
  constructor(
    @Inject(UploadedDocumentsService)
    private readonly documentsService: UploadedDocumentsService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all uploaded customer stationery documents for staff review' })
  @ApiQuery({ name: 'status', required: false, enum: DocumentStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listDocuments(
    @Query('status') status?: DocumentStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const result = await this.documentsService.listDocumentsForAdmin({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return createApiResponse(result, 'Uploaded documents retrieved for review');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full review detail of a customer uploaded document' })
  async getDocument(
    @Param('id') id: string,
    @CurrentUser() adminUser: AuthenticatedUser
  ) {
    const doc = await this.documentsService.getDocument(id, adminUser);
    return createApiResponse(doc, 'Document details retrieved for admin review');
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Admin override or approve match for an item' })
  async overrideItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateExtractedItemDto,
    @CurrentUser() adminUser: AuthenticatedUser
  ) {
    const updated = await this.documentsService.updateItem(id, itemId, dto, adminUser);
    return createApiResponse(updated, 'Item match updated by staff');
  }
}
