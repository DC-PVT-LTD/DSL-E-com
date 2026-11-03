import {
  Controller,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { StorageService } from '../storage/storage.service';
import { FileValidationPipe } from './pipes/file-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

const ALLOWED_FOLDERS = ['products', 'categories', 'brands', 'banners', 'general'] as const;
type UploadFolder = (typeof ALLOWED_FOLDERS)[number];

@ApiTags('Uploads', 'Admin API')
@Controller('uploads')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB ceiling at Multer level
      },
    })
  )
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Upload catalogue media file (Staff, Manager, Admin)',
    description:
      'Uploads an image file to local storage (or active cloud driver). Validates magic bytes, MIME types, and size limits. Returns uniform asset URL and metadata.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    enum: ALLOWED_FOLDERS,
    description: 'Target catalogue folder category (default: "products")',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image binary file (JPEG, PNG, WebP up to 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      example: {
        statusCode: 201,
        success: true,
        message: 'File uploaded successfully',
        data: {
          url: '/uploads/products/0f1e2d3c-4b5a-6789-0123-abcdef456789.webp',
          path: 'products/0f1e2d3c-4b5a-6789-0123-abcdef456789.webp',
          filename: '0f1e2d3c-4b5a-6789-0123-abcdef456789.webp',
          originalName: 'pencil-bundle.webp',
          mimeType: 'image/webp',
          sizeBytes: 245000,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error (invalid MIME, failed magic bytes, oversized)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (requires STAFF, MANAGER, or ADMIN)',
  })
  async uploadFile(
    @UploadedFile(new FileValidationPipe({ allowSvg: true })) file: Express.Multer.File,
    @Query('folder') folder?: string
  ) {
    const targetFolder = (folder?.trim().toLowerCase() as UploadFolder) || 'products';

    if (!ALLOWED_FOLDERS.includes(targetFolder)) {
      throw new BadRequestException(
        `Invalid folder "${folder}". Permitted folders: ${ALLOWED_FOLDERS.join(', ')}`
      );
    }

    const result = await this.storageService.upload(file, targetFolder);
    return createApiResponse(result, 'File uploaded successfully');
  }
}

