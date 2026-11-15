import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { BulkOrderService } from './bulk-order.service';
import {
  ValidateBulkOrderDto,
  validateBulkOrderSchema,
} from './dto/bulk-order.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Bulk Order')
@Controller('bulk-order')
export class BulkOrderController {
  constructor(
    @Inject(BulkOrderService)
    private readonly bulkOrderService: BulkOrderService
  ) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search products and variants for bulk ordering',
    description: 'Searches real catalog by SKU, name, or barcode. Returns live stock and prices.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search keyword, SKU, or barcode' })
  @ApiResponse({ status: 200, description: 'Products matched successfully' })
  async search(@Query('q') query?: string) {
    const results = await this.bulkOrderService.search(query || '');
    return createApiResponse(results, 'Products retrieved successfully');
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate multiple SKUs and quantities for bulk order',
    description: 'Validates rows from manual order table or CSV import against PostgreSQL inventory.',
  })
  @ApiBody({ type: ValidateBulkOrderDto })
  @ApiResponse({ status: 200, description: 'Bulk order rows validated' })
  async validate(
    @Body(createZodPipe(validateBulkOrderSchema)) dto: ValidateBulkOrderDto
  ) {
    const summary = await this.bulkOrderService.validateRows(dto);
    return createApiResponse(summary, 'Bulk order rows validated successfully');
  }

  @Get('template')
  @ApiOperation({
    summary: 'Download bulk order CSV template',
    description: 'Downloads standard CSV template file for bulk stationery orders.',
  })
  async downloadTemplate(@Res() res: Response) {
    const csvContent =
      'SKU,Product Name,Quantity\n' +
      'DSL-SPEED-RIM-BLUE,SPEED RIM Ball Pen Blue,50\n' +
      'DSL-DOMS-COLOUR-12,Doms 12 Colour Pencils Set,30\n' +
      'DSL-AMIGO-FX82MS,MI FX82MS - CALCULATOR,15\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dsl_bulk_order_template.csv"');
    return res.send(csvContent);
  }
}
