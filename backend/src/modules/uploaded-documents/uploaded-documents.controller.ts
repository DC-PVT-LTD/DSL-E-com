import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpCode,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { UploadedDocumentsService } from './uploaded-documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateExtractedItemDto } from './dto/update-extracted-item.dto';
import { ConfirmItemsDto } from './dto/confirm-items.dto';
import { OptionalJwtAuthGuard } from '../cart/guards/optional-jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Uploaded Documents')
@Controller('uploaded-documents')
export class UploadedDocumentsController {
  constructor(
    @Inject(UploadedDocumentsService)
    private readonly documentsService: UploadedDocumentsService
  ) {}

  private getSessionId(req: Request): string | null {
    const headerId = req.headers['x-guest-session-id'];
    if (typeof headerId === 'string' && headerId.trim()) {
      return headerId.trim();
    }
    if (req.cookies && req.cookies['dsl_guest_session']) {
      return req.cookies['dsl_guest_session'];
    }
    return null;
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a stationery list document (JPG, PNG, or PDF) for OCR processing',
  })
  @ApiBearerAuth('jwt-bearer')
  @ApiCookieAuth('jwt-cookie')
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    const sessionId = this.getSessionId(req);
    const result = await this.documentsService.uploadDocument(file, dto, user, sessionId);
    return createApiResponse(result, 'Document uploaded and analyzed successfully');
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get uploaded document details, extracted items, and candidate matches' })
  async getDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    const sessionId = this.getSessionId(req);
    const document = await this.documentsService.getDocument(id, user, sessionId);
    return createApiResponse(document, 'Document details retrieved');
  }

  @Get(':id/file')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Securely stream or preview private document file' })
  async streamFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const sessionId = this.getSessionId(req);
    const { stream, fileName, mimeType, fileSizeBytes } =
      await this.documentsService.streamDocumentFile(id, user, sessionId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileSizeBytes);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    stream.pipe(res);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Customer updates or confirms an extracted item' })
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateExtractedItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    const sessionId = this.getSessionId(req);
    const item = await this.documentsService.updateItem(id, itemId, dto, user, sessionId);
    return createApiResponse(item, 'Item updated successfully');
  }

  @Post(':id/retry')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry processing a document after failure or provider adjustment' })
  async retryDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    const sessionId = this.getSessionId(req);
    const result = await this.documentsService.retryDocument(id, user, sessionId);
    return createApiResponse(result, 'Document re-processed successfully');
  }

  @Post(':id/confirm-cart')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transfer confirmed items to the active shopping cart',
    description: 'Enforces strict confirmation check. No unconfirmed or unverified items are added.',
  })
  async confirmToCart(
    @Param('id') id: string,
    @Body() dto: ConfirmItemsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    const sessionId = this.getSessionId(req);
    const result = await this.documentsService.confirmToCart(id, dto, user, sessionId);
    return createApiResponse(result, result.message);
  }
}
