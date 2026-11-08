import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SkuGeneratorService } from './sku-generator.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryChangeReason, Prisma } from '../../generated/prisma';
import {
  ImportPreviewResult,
  ImportPreviewRow,
  ImportSummary,
  ImportRowStatus,
  ExecuteImportDto,
  NormalizedImportRow,
  ConcurrencySnapshot,
  ProductConcurrencySnapshot,
  VariantConcurrencySnapshot,
  ImportExecutionErrorCodes,
} from './dto/product-import.dto';

export class BusinessValidationException extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'BusinessValidationException';
  }
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_IMPORT_ROWS = 5000;

export interface NormalizedInputRow {
  rowNumber: number;
  sku?: string;
  name?: string;
  slug?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  description?: string;
  shortDescription?: string;
  costPrice?: number | null;
  sellingPrice?: number | null;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  barcode?: string;
  tags?: string;
  isFeatured?: boolean;
  variantName?: string;
  parentSku?: string;
  color?: string;
  variantPrice?: number | null;
  variantStock?: number | null;
  variantAttributes?: string;
  raw: Record<string, any>;
}

@Injectable()
export class ProductImportService {
  private readonly logger = new Logger(ProductImportService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SkuGeneratorService) private readonly skuGenerator: SkuGeneratorService,
    @Optional() @Inject(InventoryService) private readonly inventoryService?: InventoryService,
  ) {}

  /**
   * Generates a downloadable Excel or CSV import template with sample rows and guidelines.
   */
  async generateTemplate(format: 'xlsx' | 'csv'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DSL Stationery E-commerce';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Product Template', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'SKU', key: 'sku', width: 22 },
      { header: 'Product Name *', key: 'name', width: 35 },
      { header: 'URL Slug', key: 'slug', width: 30 },
      { header: 'Category *', key: 'category', width: 25 },
      { header: 'Subcategory', key: 'subcategory', width: 25 },
      { header: 'Brand *', key: 'brand', width: 20 },
      { header: 'Description', key: 'description', width: 45 },
      { header: 'Short Description', key: 'shortDescription', width: 35 },
      { header: 'Cost Price (LKR)', key: 'costPrice', width: 18 },
      { header: 'Selling Price (LKR) *', key: 'sellingPrice', width: 22 },
      { header: 'Stock Quantity *', key: 'stockQuantity', width: 18 },
      { header: 'Low Stock Alert', key: 'lowStockThreshold', width: 16 },
      { header: 'Barcode', key: 'barcode', width: 20 },
      { header: 'Tags (comma-separated)', key: 'tags', width: 30 },
      { header: 'Featured (TRUE/FALSE)', key: 'isFeatured', width: 22 },
      { header: 'Variant Name', key: 'variantName', width: 28 },
      { header: 'Parent SKU', key: 'parentSku', width: 22 },
      { header: 'Color', key: 'color', width: 16 },
      { header: 'Variant Price (LKR)', key: 'variantPrice', width: 20 },
      { header: 'Variant Stock', key: 'variantStock', width: 18 },
      { header: 'Variant Attributes (k:v;k:v)', key: 'variantAttributes', width: 30 },
    ];

    worksheet.columns = columns;

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Slate Blue #1e3a8a
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Sample Row 1: Standard product with auto-generated SKU
    worksheet.addRow({
      sku: '', // Auto-generate
      name: 'Atlas Chooty Blue Ballpoint Pen',
      slug: 'atlas-chooty-blue-ballpoint-pen',
      category: 'Writing Instruments',
      subcategory: 'Ballpoint Pens',
      brand: 'Atlas',
      description: 'Smooth-flowing 0.7mm fine point oil-based ballpoint pen designed for school and office writing.',
      shortDescription: 'Reliable 0.7mm fine blue pen',
      costPrice: 45.0,
      sellingPrice: 60.0,
      stockQuantity: 250,
      lowStockThreshold: 20,
      barcode: '4792012345678',
      tags: 'pen,blue,school,office',
      isFeatured: true,
      variantName: '',
      parentSku: '',
      color: '',
      variantPrice: null,
      variantStock: null,
      variantAttributes: '',
    });

    // Sample Row 2: Standard product with explicit custom SKU
    worksheet.addRow({
      sku: 'DSL-NOT-MNG-00001',
      name: 'Mango Hard Cover Exercise Book 200 Pages',
      slug: 'mango-hard-cover-exercise-book-200p',
      category: 'Books & Exercise Books',
      subcategory: 'CR Books',
      brand: 'Mango',
      description: 'Durable hard cover exercise book with high quality 70gsm smooth white paper.',
      shortDescription: '200-page ruled hardcover exercise book',
      costPrice: 210.0,
      sellingPrice: 280.0,
      stockQuantity: 150,
      lowStockThreshold: 15,
      barcode: '4792012345685',
      tags: 'exercise-book,notebook,ruled',
      isFeatured: false,
      variantName: '',
      parentSku: '',
      color: '',
      variantPrice: null,
      variantStock: null,
      variantAttributes: '',
    });

    // Sample Row 3: Variant row specifying parent SKU
    worksheet.addRow({
      sku: '', // Auto-generated variant SKU
      name: 'Atlas Chooty Ballpoint Pen - Red Variant',
      slug: '',
      category: 'Writing Instruments',
      subcategory: 'Ballpoint Pens',
      brand: 'Atlas',
      description: 'Red ink edition of the popular Atlas Chooty pen series.',
      shortDescription: 'Red ink variant 0.7mm',
      costPrice: 45.0,
      sellingPrice: 60.0,
      stockQuantity: 100,
      lowStockThreshold: 10,
      barcode: '4792012345692',
      tags: 'pen,red,school',
      isFeatured: false,
      variantName: 'Red Ink 0.7mm',
      parentSku: 'DSL-PEN-ATL-00001',
      color: 'Red',
      variantPrice: 60.0,
      variantStock: 100,
      variantAttributes: 'tip:0.7mm;ink:red',
    });

    // Add Instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions & Field Guide');
    instructionsSheet.columns = [
      { header: 'Field Name', key: 'field', width: 25 },
      { header: 'Required?', key: 'required', width: 15 },
      { header: 'Rules & Guidelines', key: 'rules', width: 70 },
      { header: 'Example', key: 'example', width: 35 },
    ];
    const instrHeader = instructionsSheet.getRow(1);
    instrHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    instrHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Teal #0f766e
    };
    instrHeader.height = 24;

    const instructionsData = [
      {
        field: 'SKU',
        required: 'Optional',
        rules: 'Leave empty to automatically allocate sequential SKU in DSL-{CAT}-{BRD}-XXXXX format. If specified, must be globally unique.',
        example: 'DSL-PEN-ATL-00001 or leave blank',
      },
      {
        field: 'Product Name',
        required: 'YES',
        rules: 'Full product name. Between 1 and 255 characters.',
        example: 'Atlas Chooty Blue Ballpoint Pen',
      },
      {
        field: 'Category',
        required: 'YES',
        rules: 'Must match an existing category name or URL slug in DSL Stationery.',
        example: 'Writing Instruments',
      },
      {
        field: 'Subcategory',
        required: 'Optional',
        rules: 'If provided, must exist in DSL Stationery AND belong to the selected parent category.',
        example: 'Ballpoint Pens',
      },
      {
        field: 'Brand',
        required: 'YES',
        rules: 'Must match an existing brand name or URL slug in DSL Stationery.',
        example: 'Atlas or Natraj or Mango',
      },
      {
        field: 'Selling Price (LKR)',
        required: 'YES',
        rules: 'Positive decimal number in Sri Lankan Rupees (LKR). Must be greater than 0.',
        example: '60.00',
      },
      {
        field: 'Cost Price (LKR)',
        required: 'Optional',
        rules: 'Non-negative decimal number in LKR. Must be >= 0.',
        example: '45.00',
      },
      {
        field: 'Stock Quantity',
        required: 'YES',
        rules: 'Non-negative whole integer. Must be >= 0.',
        example: '250',
      },
      {
        field: 'Low Stock Alert',
        required: 'Optional',
        rules: 'Threshold integer for low stock notification. Default is 5.',
        example: '15',
      },
      {
        field: 'Tags',
        required: 'Optional',
        rules: 'Comma-separated search tags.',
        example: 'pen,writing,stationery',
      },
      {
        field: 'Variant Name / Parent SKU',
        required: 'Optional',
        rules: 'Use to define a product variant under a parent SKU. Color and variant stock apply.',
        example: 'parentSku: DSL-PEN-ATL-00001, color: Red',
      },
    ];

    instructionsSheet.addRows(instructionsData);

    if (format === 'csv') {
      const csvBuffer = await workbook.csv.writeBuffer({ sheetName: 'Product Template' });
      return Buffer.from(csvBuffer);
    }

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(xlsxBuffer);
  }

  /**
   * Parses uploaded Excel/CSV file and performs strict validation against the database.
   * STRICT GUARANTEE: Performs ZERO database writes, modifications, stock changes, or migrations
   * unless actor is supplied, in which case an audit-traceable ProductImportPreview record is saved.
   */
  async parseAndValidate(
    file: Express.Multer.File,
    actor?: { id: string }
  ): Promise<ImportPreviewResult> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No file uploaded or uploaded file is empty.');
    }

    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Uploaded file (${(file.buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed size of 10MB.`
      );
    }

    const rawRows = await this.parseFileToRows(file);

    if (rawRows.length === 0) {
      return {
        summary: {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          warningRows: 0,
          duplicateRows: 0,
          existingRows: 0,
          newProducts: 0,
          newVariants: 0,
        },
        rows: [],
        fileName: file.originalname || 'uploaded-file',
        fileSizeBytes: file.buffer.length,
        parsedAt: new Date().toISOString(),
      };
    }

    if (rawRows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `File contains ${rawRows.length} rows, exceeding maximum limit of ${MAX_IMPORT_ROWS} rows per import batch.`
      );
    }

    return this.validateRows(
      rawRows,
      file.originalname || 'uploaded-file',
      file.buffer.length,
      actor,
      file.buffer
    );
  }

  /**
   * Generates a downloadable error report spreadsheet containing failed rows and exact error reasons.
   */
  async generateErrorReport(rows: ImportPreviewRow[], format: 'csv' | 'xlsx'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DSL Stationery E-commerce';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Validation Report', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = [
      { header: 'Row #', key: 'rowNumber', width: 10 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Validation Errors', key: 'errors', width: 45 },
      { header: 'Validation Warnings', key: 'warnings', width: 40 },
      { header: 'SKU', key: 'sku', width: 22 },
      { header: 'Product Name', key: 'name', width: 35 },
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Subcategory', key: 'subcategory', width: 25 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Selling Price', key: 'sellingPrice', width: 16 },
      { header: 'Cost Price', key: 'costPrice', width: 16 },
      { header: 'Stock Quantity', key: 'stockQuantity', width: 16 },
      { header: 'Parent SKU', key: 'parentSku', width: 20 },
      { header: 'Color', key: 'color', width: 15 },
      { header: 'Barcode', key: 'barcode', width: 18 },
    ];

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF991B1B' }, // Dark Red #991b1b
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 26;

    for (const r of rows) {
      const addedRow = worksheet.addRow({
        rowNumber: r.rowNumber,
        status: r.status,
        errors: r.errors.join(' | ') || 'None',
        warnings: r.warnings.join(' | ') || 'None',
        sku: r.sku || r.proposedSku,
        name: r.name,
        category: r.categoryName,
        subcategory: r.subcategoryName || '',
        brand: r.brandName,
        sellingPrice: r.sellingPrice,
        costPrice: r.costPrice ?? '',
        stockQuantity: r.stockQuantity,
        parentSku: r.parentSku || '',
        color: r.color || '',
        barcode: r.barcode || '',
      });

      // Highlight invalid rows with soft red
      if (r.status === 'INVALID' || r.status === 'DUPLICATE_IN_FILE') {
        addedRow.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' },
        };
      } else if (r.status === 'WARNING') {
        addedRow.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' },
        };
      }
    }

    if (format === 'csv') {
      const csvBuffer = await workbook.csv.writeBuffer();
      return Buffer.from(csvBuffer);
    }

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(xlsxBuffer);
  }

  // ---------------------------------------------------------------------------
  // Internal Parsing Helpers
  // ---------------------------------------------------------------------------

  private async parseFileToRows(file: Express.Multer.File): Promise<NormalizedInputRow[]> {
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
    const isCsv = ext === 'csv' || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';

    if (isCsv) {
      return this.parseCsv(file.buffer);
    } else if (ext === 'xlsx' || ext === 'xls' || file.mimetype.includes('spreadsheetml')) {
      return this.parseExcel(file.buffer);
    } else {
      // Fallback: try parsing as Excel first, then CSV
      try {
        return await this.parseExcel(file.buffer);
      } catch {
        return this.parseCsv(file.buffer);
      }
    }
  }

  private async parseExcel(buffer: Buffer): Promise<NormalizedInputRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse Excel workbook: ${err.message || 'Corrupt file structure'}`);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }

    const rows: NormalizedInputRow[] = [];
    const headerMap = new Map<string, number>();

    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      const headerText = this.normalizeHeader(String(cell.value || ''));
      if (headerText) {
        headerMap.set(headerText, colNumber);
      }
    });

    const getVal = (row: ExcelJS.Row, keyCandidates: string[]): any => {
      for (const k of keyCandidates) {
        const colIdx = headerMap.get(k);
        if (colIdx !== undefined) {
          const cell = row.getCell(colIdx);
          return this.extractCellValue(cell);
        }
      }
      return undefined;
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip headers

      // Skip empty rows
      let hasData = false;
      row.eachCell(() => {
        hasData = true;
      });
      if (!hasData) return;

      const rawObj: Record<string, any> = {};
      headerMap.forEach((colIdx, headerKey) => {
        rawObj[headerKey] = this.extractCellValue(row.getCell(colIdx));
      });

      const normalized: NormalizedInputRow = {
        rowNumber,
        sku: this.cleanString(getVal(row, ['sku', 'productsku'])),
        name: this.cleanString(getVal(row, ['name', 'productname', 'title'])),
        slug: this.cleanString(getVal(row, ['slug', 'urlslug'])),
        category: this.cleanString(getVal(row, ['category', 'categoryname', 'categorynameorslug', 'parentcategory'])),
        subcategory: this.cleanString(getVal(row, ['subcategory', 'subcategoryname', 'subcategorynameorslug', 'subcat'])),
        brand: this.cleanString(getVal(row, ['brand', 'brandname', 'brandnameorslug'])),
        description: this.cleanString(getVal(row, ['description', 'desc'])),
        shortDescription: this.cleanString(getVal(row, ['shortdescription', 'shortdesc'])),
        costPrice: this.cleanNumber(getVal(row, ['costprice', 'costpricecents', 'cost'])),
        sellingPrice: this.cleanNumber(getVal(row, ['sellingprice', 'price', 'pricecents', 'regularprice'])),
        stockQuantity: this.cleanInteger(getVal(row, ['stockquantity', 'stock', 'qty', 'quantity'])),
        lowStockThreshold: this.cleanInteger(getVal(row, ['lowstockthreshold', 'lowstock', 'alertthreshold'])),
        barcode: this.cleanString(getVal(row, ['barcode', 'upc', 'ean'])),
        tags: this.cleanString(getVal(row, ['tags', 'keywords'])),
        isFeatured: this.cleanBoolean(getVal(row, ['isfeatured', 'featured'])),
        variantName: this.cleanString(getVal(row, ['variantname', 'variant'])),
        parentSku: this.cleanString(getVal(row, ['parentsku', 'parentproductsku'])),
        color: this.cleanString(getVal(row, ['color', 'colour'])),
        variantPrice: this.cleanNumber(getVal(row, ['variantprice'])),
        variantStock: this.cleanInteger(getVal(row, ['variantstock', 'variantquantity'])),
        variantAttributes: this.cleanString(getVal(row, ['variantattributes', 'attributes'])),
        raw: rawObj,
      };

      // Only push if at least name or sku or category has text
      if (normalized.name || normalized.sku || normalized.category) {
        rows.push(normalized);
      }
    });

    return rows;
  }

  private parseCsv(buffer: Buffer): NormalizedInputRow[] {
    const content = buffer.toString('utf-8').replace(/^\uFEFF/, ''); // Strip BOM
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return [];
    }

    const headerLine = lines[0];
    const headers = this.parseCsvLine(headerLine).map((h) => this.normalizeHeader(h));
    const headerMap = new Map<string, number>();
    headers.forEach((h, idx) => {
      if (h) headerMap.set(h, idx);
    });

    const getVal = (cells: string[], keyCandidates: string[]): string | undefined => {
      for (const k of keyCandidates) {
        const colIdx = headerMap.get(k);
        if (colIdx !== undefined && colIdx < cells.length) {
          const v = cells[colIdx];
          return v !== undefined && v !== null ? String(v).trim() : undefined;
        }
      }
      return undefined;
    };

    const rows: NormalizedInputRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const cells = this.parseCsvLine(line);
      const rowNumber = i + 1; // 1-based index matching spreadsheet

      const rawObj: Record<string, any> = {};
      headerMap.forEach((colIdx, headerKey) => {
        rawObj[headerKey] = cells[colIdx] ?? '';
      });

      const normalized: NormalizedInputRow = {
        rowNumber,
        sku: this.cleanString(getVal(cells, ['sku', 'productsku'])),
        name: this.cleanString(getVal(cells, ['name', 'productname', 'title'])),
        slug: this.cleanString(getVal(cells, ['slug', 'urlslug'])),
        category: this.cleanString(getVal(cells, ['category', 'categoryname', 'categorynameorslug', 'parentcategory'])),
        subcategory: this.cleanString(getVal(cells, ['subcategory', 'subcategoryname', 'subcategorynameorslug', 'subcat'])),
        brand: this.cleanString(getVal(cells, ['brand', 'brandname', 'brandnameorslug'])),
        description: this.cleanString(getVal(cells, ['description', 'desc'])),
        shortDescription: this.cleanString(getVal(cells, ['shortdescription', 'shortdesc'])),
        costPrice: this.cleanNumber(getVal(cells, ['costprice', 'costpricecents', 'cost'])),
        sellingPrice: this.cleanNumber(getVal(cells, ['sellingprice', 'price', 'pricecents', 'regularprice'])),
        stockQuantity: this.cleanInteger(getVal(cells, ['stockquantity', 'stock', 'qty', 'quantity'])),
        lowStockThreshold: this.cleanInteger(getVal(cells, ['lowstockthreshold', 'lowstock', 'alertthreshold'])),
        barcode: this.cleanString(getVal(cells, ['barcode', 'upc', 'ean'])),
        tags: this.cleanString(getVal(cells, ['tags', 'keywords'])),
        isFeatured: this.cleanBoolean(getVal(cells, ['isfeatured', 'featured'])),
        variantName: this.cleanString(getVal(cells, ['variantname', 'variant'])),
        parentSku: this.cleanString(getVal(cells, ['parentsku', 'parentproductsku'])),
        color: this.cleanString(getVal(cells, ['color', 'colour'])),
        variantPrice: this.cleanNumber(getVal(cells, ['variantprice'])),
        variantStock: this.cleanInteger(getVal(cells, ['variantstock', 'variantquantity'])),
        variantAttributes: this.cleanString(getVal(cells, ['variantattributes', 'attributes'])),
        raw: rawObj,
      };

      if (normalized.name || normalized.sku || normalized.category) {
        rows.push(normalized);
      }
    }

    return rows;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    const delimiter = line.includes(';') && !line.includes(',') ? ';' : ',';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  // ---------------------------------------------------------------------------
  // Validation Engine
  // ---------------------------------------------------------------------------

  private async validateRows(
    rawRows: NormalizedInputRow[],
    fileName: string,
    fileSizeBytes: number,
    actor?: { id: string },
    fileBuffer?: Buffer
  ): Promise<ImportPreviewResult> {
    // 1. Batch load categories and brands for in-memory O(1) matching
    const [categories, brands] = await Promise.all([
      this.prisma.category.findMany({
        select: { id: true, name: true, slug: true, parentId: true },
      }),
      this.prisma.brand.findMany({
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const categoryBySlug = new Map<string, (typeof categories)[0]>();
    const categoryByName = new Map<string, (typeof categories)[0]>();
    const categoryById = new Map<string, (typeof categories)[0]>();

    for (const cat of categories) {
      categoryById.set(cat.id, cat);
      categoryBySlug.set(cat.slug.toLowerCase(), cat);
      categoryByName.set(cat.name.toLowerCase(), cat);
    }

    const brandBySlug = new Map<string, (typeof brands)[0]>();
    const brandByName = new Map<string, (typeof brands)[0]>();

    for (const brd of brands) {
      brandBySlug.set(brd.slug.toLowerCase(), brd);
      brandByName.set(brd.name.toLowerCase(), brd);
    }

    // 2. Collect explicit SKUs and query GlobalSku, Products, Variants in one batch
    const explicitSkus = new Set<string>();
    const fileSkuRowMap = new Map<string, number[]>();

    for (const r of rawRows) {
      if (r.sku) {
        const upper = r.sku.toUpperCase();
        explicitSkus.add(upper);
        const list = fileSkuRowMap.get(upper) || [];
        list.push(r.rowNumber);
        fileSkuRowMap.set(upper, list);
      }
      if (r.parentSku) {
        explicitSkus.add(r.parentSku.toUpperCase());
      }
    }

    const existingGlobalSkus = new Map<string, any>();
    const existingProductsMap = new Map<string, any>();
    const existingVariantsMap = new Map<string, any>();

    if (explicitSkus.size > 0) {
      const skuList = Array.from(explicitSkus);
      const [dbSkus, dbProducts, dbVariants] = await Promise.all([
        this.prisma.globalSku.findMany({
          where: { sku: { in: skuList } },
          select: {
            sku: true,
            ownerType: true,
            productId: true,
            variantId: true,
          },
        }),
        this.prisma.product?.findMany
          ? this.prisma.product.findMany({
              where: { sku: { in: skuList } },
              select: {
                id: true,
                sku: true,
                name: true,
                priceCents: true,
                costPriceCents: true,
                categoryId: true,
                subcategoryId: true,
                brandId: true,
                updatedAt: true,
              },
            })
          : Promise.resolve([]),
        this.prisma.productVariant?.findMany
          ? this.prisma.productVariant.findMany({
              where: { sku: { in: skuList } },
              select: {
                id: true,
                sku: true,
                productId: true,
                name: true,
                priceCents: true,
                costPriceCents: true,
                attributes: true,
                updatedAt: true,
              },
            })
          : Promise.resolve([]),
      ]);

      for (const gs of dbSkus) {
        existingGlobalSkus.set(gs.sku.toUpperCase(), gs);
      }
      for (const prod of dbProducts) {
        existingProductsMap.set(prod.sku.toUpperCase(), prod);
      }
      for (const v of dbVariants) {
        existingVariantsMap.set(v.sku.toUpperCase(), v);
      }
    }

    // Track products in file by SKU to allow variants in the same file to link to them
    const fileProductsBySku = new Set<string>();
    for (const r of rawRows) {
      if (r.sku && !r.parentSku) {
        fileProductsBySku.add(r.sku.toUpperCase());
      }
    }

    // 3. Row-by-row validation
    const previewRows: ImportPreviewRow[] = [];
    const normalizedRows: NormalizedImportRow[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let warningCount = 0;
    let duplicateCount = 0;
    let existingCount = 0;
    let newProductsCount = 0;
    let newVariantsCount = 0;

    for (const r of rawRows) {
      const errors: string[] = [];
      const warnings: string[] = [];
      const isVariant = Boolean(r.parentSku || r.variantName);

      // (a) Required Field: Name
      if (!r.name) {
        errors.push('Product name is required');
      } else if (r.name.length > 255) {
        errors.push('Product name cannot exceed 255 characters');
      }

      // (b) Category validation
      let matchedCategory: (typeof categories)[0] | undefined;
      let matchedSubcategory: (typeof categories)[0] | undefined;

      if (!r.category) {
        errors.push('Category is required');
      } else {
        const catKey = r.category.toLowerCase();
        matchedCategory = categoryBySlug.get(catKey) || categoryByName.get(catKey);
        if (!matchedCategory) {
          errors.push(`Category "${r.category}" not found in database`);
        }
      }

      // (c) Subcategory validation (if provided)
      if (r.subcategory && matchedCategory) {
        const subKey = r.subcategory.toLowerCase();
        matchedSubcategory = categoryBySlug.get(subKey) || categoryByName.get(subKey);

        if (!matchedSubcategory) {
          errors.push(`Subcategory "${r.subcategory}" not found in database`);
        } else if (matchedSubcategory.parentId !== matchedCategory.id) {
          errors.push(
            `Subcategory "${matchedSubcategory.name}" does not belong to category "${matchedCategory.name}"`
          );
        }
      }

      // (d) Brand validation
      let matchedBrand: (typeof brands)[0] | undefined;
      if (!r.brand) {
        errors.push('Brand is required');
      } else {
        const brdKey = r.brand.toLowerCase();
        matchedBrand = brandBySlug.get(brdKey) || brandByName.get(brdKey);
        if (!matchedBrand) {
          errors.push(`Brand "${r.brand}" not found in database`);
        }
      }

      // (e) Price validations
      if (r.sellingPrice === undefined || r.sellingPrice === null) {
        errors.push('Selling price is required');
      } else if (isNaN(r.sellingPrice) || r.sellingPrice <= 0) {
        errors.push(`Invalid selling price "${r.sellingPrice}". Must be a positive number greater than 0.`);
      }

      if (r.costPrice !== undefined && r.costPrice !== null) {
        if (isNaN(r.costPrice) || r.costPrice < 0) {
          errors.push(`Invalid cost price "${r.costPrice}". Must be a non-negative number.`);
        } else if (r.sellingPrice !== null && r.sellingPrice !== undefined && r.sellingPrice < r.costPrice) {
          warnings.push(
            `Selling price (LKR ${r.sellingPrice.toFixed(2)}) is lower than cost price (LKR ${r.costPrice.toFixed(2)}). Product will sell at a loss.`
          );
        }
      }

      // (f) Stock Quantity validations
      if (r.stockQuantity === undefined || r.stockQuantity === null) {
        errors.push('Stock quantity is required');
      } else if (isNaN(r.stockQuantity) || r.stockQuantity < 0 || !Number.isInteger(r.stockQuantity)) {
        errors.push(`Invalid stock quantity "${r.stockQuantity}". Must be a whole non-negative integer.`);
      }

      if (r.lowStockThreshold !== undefined && r.lowStockThreshold !== null) {
        if (isNaN(r.lowStockThreshold) || r.lowStockThreshold < 0 || !Number.isInteger(r.lowStockThreshold)) {
          errors.push(`Invalid low stock threshold "${r.lowStockThreshold}". Must be a whole non-negative integer.`);
        }
      }

      // (g) Variant-specific validations
      if (isVariant) {
        if (r.parentSku) {
          const pSkuUpper = r.parentSku.toUpperCase();
          const parentInFile = fileProductsBySku.has(pSkuUpper);
          const parentInDb = existingGlobalSkus.get(pSkuUpper);

          if (!parentInFile && !parentInDb) {
            errors.push(
              `Parent SKU "${r.parentSku}" not found in uploaded file or database. Variant cannot be linked.`
            );
          }
        }

        if (r.variantPrice !== null && r.variantPrice !== undefined && r.variantPrice <= 0) {
          errors.push(`Invalid variant price "${r.variantPrice}". Must be greater than 0.`);
        }

        if (r.variantStock !== null && r.variantStock !== undefined && (r.variantStock < 0 || !Number.isInteger(r.variantStock))) {
          errors.push(`Invalid variant stock "${r.variantStock}". Must be a whole non-negative integer.`);
        }
      }

      // (h) SKU validations: within-file duplicate check & database existence
      let isExisting = false;
      let isDuplicateInFile = false;
      let proposedSku = r.sku || '';

      if (r.sku) {
        const upperSku = r.sku.toUpperCase();

        // Check format: basic alphanumeric with dashes/underscores
        if (!/^[A-Z0-9_-]{3,50}$/.test(upperSku)) {
          errors.push(`Invalid SKU format "${r.sku}". Must be 3-50 alphanumeric characters (hyphens and underscores allowed).`);
        }

        // Within-file duplicate check
        const rowsWithThisSku = fileSkuRowMap.get(upperSku) || [];
        if (rowsWithThisSku.length > 1) {
          isDuplicateInFile = true;
          const otherRows = rowsWithThisSku.filter((rn) => rn !== r.rowNumber);
          errors.push(`Duplicate SKU "${r.sku}" found in file on rows ${rowsWithThisSku.join(', ')}.`);
        }

        // Database existence check
        const dbRecord = existingGlobalSkus.get(upperSku);
        if (dbRecord) {
          isExisting = true;
          warnings.push(
            `SKU "${r.sku}" already exists in database (owner: ${dbRecord.ownerType}). Product will be updated rather than created on execution.`
          );
        }
      } else {
        // Auto-generated SKU preview
        const catCode = matchedCategory
          ? this.skuGenerator.getCategoryCode(matchedCategory.slug || matchedCategory.name)
          : 'CAT';
        const brdCode = matchedBrand
          ? this.skuGenerator.getBrandCode(matchedBrand.slug || matchedBrand.name)
          : 'BRD';

        if (isVariant && r.color) {
          const colorCode = this.skuGenerator.getColorCode(r.color);
          proposedSku = `DSL-${catCode}-${brdCode}-XXXXX-${colorCode}`;
        } else {
          proposedSku = `DSL-${catCode}-${brdCode}-XXXXX`;
        }
      }

      // (i) Determine Status
      let status: ImportRowStatus;
      if (isDuplicateInFile) {
        status = 'DUPLICATE_IN_FILE';
        duplicateCount++;
      } else if (errors.length > 0) {
        status = 'INVALID';
        invalidCount++;
      } else if (isExisting) {
        status = 'EXISTS_IN_DB';
        existingCount++;
        validCount++; // Syntactically valid, will update
      } else if (warnings.length > 0) {
        status = 'WARNING';
        warningCount++;
        validCount++;
      } else {
        status = 'VALID';
        validCount++;
      }

      if (errors.length === 0) {
        if (isVariant) {
          newVariantsCount++;
        } else {
          newProductsCount++;
        }
      }

      // Tags array extraction
      const tagsList = r.tags
        ? r.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      // Concurrency snapshot extraction for existing items
      let snapshot: ConcurrencySnapshot | null = null;
      let existingId: string | null = null;
      const targetSku = r.sku ? r.sku.toUpperCase() : null;

      if (isVariant && targetSku && existingVariantsMap.has(targetSku)) {
        const v = existingVariantsMap.get(targetSku)!;
        existingId = v.id;
        snapshot = {
          targetType: 'VARIANT',
          id: v.id,
          productId: v.productId,
          updatedAt: v.updatedAt.toISOString(),
          fields: {
            name: v.name,
            priceCents: v.priceCents,
            costPriceCents: v.costPriceCents,
            attributes: (v.attributes as Record<string, string>) || {},
          },
        };
      } else if (!isVariant && targetSku && existingProductsMap.has(targetSku)) {
        const p = existingProductsMap.get(targetSku)!;
        existingId = p.id;
        snapshot = {
          targetType: 'PRODUCT',
          id: p.id,
          updatedAt: p.updatedAt.toISOString(),
          fields: {
            name: p.name,
            priceCents: p.priceCents,
            costPriceCents: p.costPriceCents,
            categoryId: p.categoryId,
            subcategoryId: p.subcategoryId,
            brandId: p.brandId,
          },
        };
      }

      previewRows.push({
        rowNumber: r.rowNumber,
        sku: r.sku ? r.sku.toUpperCase() : null,
        proposedSku,
        name: r.name || '',
        slug: r.slug,
        categoryName: matchedCategory ? matchedCategory.name : r.category || '',
        categoryId: matchedCategory?.id,
        subcategoryName: matchedSubcategory ? matchedSubcategory.name : r.subcategory || null,
        subcategoryId: matchedSubcategory?.id,
        brandName: matchedBrand ? matchedBrand.name : r.brand || '',
        brandId: matchedBrand?.id,
        sellingPrice: r.sellingPrice || 0,
        costPrice: r.costPrice,
        stockQuantity: r.stockQuantity || 0,
        lowStockThreshold: r.lowStockThreshold || 5,
        barcode: r.barcode,
        tags: tagsList,
        isFeatured: r.isFeatured || false,
        isVariant,
        variantName: r.variantName,
        parentSku: r.parentSku ? r.parentSku.toUpperCase() : null,
        color: r.color,
        variantPrice: r.variantPrice,
        variantStock: r.variantStock,
        status,
        isExisting,
        errors,
        warnings,
        raw: r.raw,
      });

      normalizedRows.push({
        rowNumber: r.rowNumber,
        sku: targetSku,
        name: r.name || '',
        slug: r.slug,
        categoryName: matchedCategory ? matchedCategory.name : r.category || '',
        categoryId: matchedCategory?.id,
        subcategoryName: matchedSubcategory ? matchedSubcategory.name : r.subcategory || null,
        subcategoryId: matchedSubcategory?.id,
        brandName: matchedBrand ? matchedBrand.name : r.brand || '',
        brandId: matchedBrand?.id,
        sellingPrice: r.sellingPrice || 0,
        costPrice: r.costPrice,
        stockQuantity: r.stockQuantity || 0,
        lowStockThreshold: r.lowStockThreshold || 5,
        barcode: r.barcode,
        tags: tagsList,
        isFeatured: r.isFeatured || false,
        isVariant,
        variantName: r.variantName,
        parentSku: r.parentSku ? r.parentSku.toUpperCase() : null,
        color: r.color,
        variantPrice: r.variantPrice,
        variantStock: r.variantStock,
        variantAttributes: r.variantAttributes,
        isExisting,
        existingId,
        snapshot,
        raw: r.raw,
      });
    }

    const summary: ImportSummary = {
      totalRows: rawRows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      warningRows: warningCount,
      duplicateRows: duplicateCount,
      existingRows: existingCount,
      newProducts: newProductsCount,
      newVariants: newVariantsCount,
    };

    const previewChecksum = crypto
      .createHash('sha256')
      .update(this.canonicalJson(normalizedRows))
      .digest('hex');

    let previewId = `preview_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let expiresAt: string | undefined = undefined;

    if (actor?.id && fileBuffer) {
      const fileSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const expDate = new Date(Date.now() + 4 * 60 * 60 * 1000);
      expiresAt = expDate.toISOString();

      const storedPreview = await this.prisma.productImportPreview.create({
        data: {
          fileName,
          fileSize: fileSizeBytes,
          fileSha256,
          previewChecksum,
          normalizedRows: normalizedRows as any,
          summary: summary as any,
          createdById: actor.id,
          expiresAt: expDate,
        },
      });
      previewId = storedPreview.id;
    }

    return {
      previewId,
      previewChecksum,
      expiresAt,
      summary,
      rows: previewRows,
      fileName,
      fileSizeBytes,
      parsedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Data Extraction Utilities
  // ---------------------------------------------------------------------------

  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[*()]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private extractCellValue(cell: ExcelJS.Cell): any {
    if (!cell) return undefined;
    const val = cell.value;
    if (val === null || val === undefined) return undefined;

    if (typeof val === 'object') {
      if ('text' in val) return (val as any).text;
      if ('result' in val) return (val as any).result;
      if (val instanceof Date) return val.toISOString();
    }
    return val;
  }

  private cleanString(val: any): string | undefined {
    if (val === null || val === undefined) return undefined;
    const str = String(val).trim();
    return str.length > 0 ? str : undefined;
  }

  private cleanNumber(val: any): number | null | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? undefined : num;
  }

  private cleanInteger(val: any): number | null | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const cleanStr = String(val).trim();
    const num = Number(cleanStr);
    return isNaN(num) ? undefined : num;
  }

  private cleanBoolean(val: any): boolean | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const str = String(val).trim().toLowerCase();
    if (str === 'true' || str === 'yes' || str === '1' || str === 'y') return true;
    if (str === 'false' || str === 'no' || str === '0' || str === 'n') return false;
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Canonical Serialization Utility
  // ---------------------------------------------------------------------------

  canonicalJson(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this.canonicalJson(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => JSON.stringify(key) + ':' + this.canonicalJson(obj[key]));
    return '{' + pairs.join(',') + '}';
  }

  // ---------------------------------------------------------------------------
  // Stage 4: Execution Engine & Batch Management
  // ---------------------------------------------------------------------------

  /**
   * Executes a verified product import preview with chunked transactions, pessimistic locking,
   * idempotency, GlobalSku sync, and atomic failure rollbacks.
   */
  async executeImport(
    actor: { id: string; email?: string; role?: string },
    dto: ExecuteImportDto
  ) {
    // 1. Authenticate user & verify granular permissions
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: {
        assignedRole: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new ForbiddenException('Forbidden: Inactive or invalid administrator account');
    }

    const isSuperAdmin =
      user.role === 'ADMIN' && (!user.roleId || user.assignedRole?.slug === 'super-admin');
    const grantedKeys = new Set<string>(
      user.assignedRole?.permissions.map((rp) => rp.permission.key) || []
    );

    const hasPerm = (key: string) => isSuperAdmin || grantedKeys.has(key);

    if (!hasPerm('products.import')) {
      throw new ForbiddenException('Forbidden: Insufficient permissions (missing "products.import")');
    }

    // 2. Load preview & verify ownership, expiry, and checksum
    const preview = await this.prisma.productImportPreview.findUnique({
      where: { id: dto.previewId },
    });

    if (!preview) {
      throw new NotFoundException(`Import preview "${dto.previewId}" not found`);
    }

    if (preview.createdById !== actor.id) {
      throw new ForbiddenException(
        'Forbidden: Access denied to import preview generated by another administrator'
      );
    }

    if (new Date(preview.expiresAt) <= new Date()) {
      throw new BadRequestException(
        'Import preview has expired. Please re-upload the file to generate a fresh preview.'
      );
    }

    const normalizedRows = preview.normalizedRows as unknown as NormalizedImportRow[];
    const computedChecksum = crypto
      .createHash('sha256')
      .update(this.canonicalJson(normalizedRows))
      .digest('hex');

    if (
      computedChecksum !== preview.previewChecksum ||
      dto.previewChecksum !== preview.previewChecksum
    ) {
      throw new BadRequestException(
        'ERR_PREVIEW_CORRUPTED: Canonical preview checksum verification failed. File preview data may have been altered.'
      );
    }

    // 3. Operation-level least-privilege checks against preview contents
    const hasNewItems = normalizedRows.some((r) => !r.isExisting);
    const hasExistingItems = normalizedRows.some((r) => r.isExisting);
    const modifiesStock = dto.stockMode === 'SET_STOCK' || dto.stockMode === 'ADD_STOCK';

    if (hasNewItems && !hasPerm('products.create')) {
      throw new ForbiddenException(
        'Forbidden: Insufficient permissions (batch creates new items, but actor lacks "products.create")'
      );
    }
    if (dto.allowUpdates && hasExistingItems && !hasPerm('products.edit')) {
      throw new ForbiddenException(
        'Forbidden: Insufficient permissions (batch modifies existing items, but actor lacks "products.edit")'
      );
    }
    if (modifiesStock && !hasPerm('inventory.update')) {
      throw new ForbiddenException(
        'Forbidden: Insufficient permissions (batch adjusts inventory, but actor lacks "inventory.update")'
      );
    }

    // 4. Request fingerprint and persistent idempotency binding
    const requestFingerprint = crypto
      .createHash('sha256')
      .update(`${actor.id}:${dto.previewId}:${dto.stockMode}:${dto.allowUpdates}`)
      .digest('hex');

    const totalChunks = Math.ceil(normalizedRows.length / 50);

    let batch: any;
    try {
      batch = await this.prisma.productImportBatch.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          adminId: actor.id,
          previewId: dto.previewId,
          requestFingerprint,
          stockMode: dto.stockMode,
          allowUpdates: dto.allowUpdates,
          status: 'PENDING',
          totalRows: normalizedRows.length,
          totalChunks,
          committedChunk: 0,
        },
      });
    } catch (createErr: any) {
      if (createErr?.code === 'P2002' || createErr?.message?.includes('idempotencyKey')) {
        const existing = await this.prisma.productImportBatch.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { results: true },
        });

        if (!existing) throw createErr;

        // Cross-admin reuse -> 403 Forbidden without leaking batch details
        if (existing.adminId !== actor.id) {
          throw new ForbiddenException('Forbidden: Access denied');
        }

        // Parameter mismatch -> 409 Conflict
        if (existing.requestFingerprint !== requestFingerprint) {
          throw new ConflictException(
            'ERR_IDEMPOTENCY_MISMATCH: Idempotency key already used with different execution parameters.'
          );
        }

        // Cached completed response -> return existing batch
        if (existing.status === 'COMPLETED' || existing.status === 'PARTIALLY_FAILED') {
          return this.formatBatchResponse(existing);
        }

        // In-flight active processing check
        if (existing.status === 'PROCESSING' || existing.status === 'PENDING') {
          const lease = await this.prisma.importExecutionLease.findUnique({
            where: { id: 'GLOBAL_IMPORT_LEASE' },
          });
          const isLeaseActive =
            lease && lease.batchId === existing.id && new Date(lease.expiresAt) > new Date();

          if (isLeaseActive) {
            throw new ConflictException({
              statusCode: 409,
              error: 'Conflict',
              message:
                'Import batch is currently actively processing. Please wait for completion.',
              batch: this.formatBatchResponse(existing),
            });
          }
        }

        batch = existing;
      } else {
        throw createErr;
      }
    }

    // 5. Acquire global execution lease
    const leaseAcquired = await this.prisma.$executeRaw`
      UPDATE "ImportExecutionLease"
      SET "batchId" = ${batch.id},
          "ownerId" = ${actor.id},
          "status" = 'ACTIVE',
          "currentChunk" = ${batch.committedChunk},
          "heartbeatAt" = NOW(),
          "expiresAt" = NOW() + INTERVAL '2 minutes',
          "updatedAt" = NOW()
      WHERE "id" = 'GLOBAL_IMPORT_LEASE'
        AND ("expiresAt" < NOW() OR "status" = 'IDLE' OR "batchId" = ${batch.id})
    `;

    if (leaseAcquired === 0) {
      throw new ConflictException(
        'ERR_LEASE_ACQUISITION_FAILED: Another product import execution is currently active. Please try again after it completes.'
      );
    }

    await this.prisma.productImportBatch.update({
      where: { id: batch.id },
      data: {
        status: 'PROCESSING',
        startedAt: batch.startedAt || new Date(),
      },
    });

    // 6. Process chunks (50 rows per chunk)
    const chunkSize = 50;

    try {
      for (let k = batch.committedChunk; k < totalChunks; k++) {
        const chunkSlice = normalizedRows.slice(k * chunkSize, (k + 1) * chunkSize);

        await this.prisma.$transaction(
          async (tx) => {
            // Defensive timeout parameters
            await tx.$executeRaw`SET LOCAL lock_timeout = '5000ms'`;
            await tx.$executeRaw`SET LOCAL statement_timeout = '30000ms'`;

            // Lock lease and assert invariants
            const lockedLeases = await tx.$queryRaw<
              Array<{
                id: string;
                batchId: string | null;
                ownerId: string | null;
                status: string;
                currentChunk: number;
                expiresAt: Date;
              }>
            >`
              SELECT id, "batchId", "ownerId", status, "currentChunk", "expiresAt"
              FROM "ImportExecutionLease"
              WHERE id = 'GLOBAL_IMPORT_LEASE'
              FOR UPDATE
            `;

            const currentLease = lockedLeases[0];

            if (
              !currentLease ||
              currentLease.status !== 'ACTIVE' ||
              currentLease.batchId !== batch.id ||
              currentLease.ownerId !== actor.id ||
              new Date(currentLease.expiresAt) <= new Date() ||
              currentLease.currentChunk !== k
            ) {
              throw new Error(
                `ImportLeaseLostException: Lease expired or transferred before chunk ${k}. Aborting chunk.`
              );
            }

            const chunkRowResults: any[] = [];
            let chunkSuccess = 0;
            let chunkFailed = 0;

            for (const row of chunkSlice) {
              try {
                const outcome = await this.executeSingleRowInsideTx(tx, row, {
                  batchId: batch.id,
                  stockMode: dto.stockMode,
                  allowUpdates: dto.allowUpdates,
                  actorId: actor.id,
                });
                chunkRowResults.push(outcome);
                chunkSuccess++;
              } catch (rowErr: any) {
                if (this.isRecoverableRowError(rowErr)) {
                  chunkRowResults.push({
                    batchId: batch.id,
                    rowNumber: row.rowNumber,
                    sku: row.sku || null,
                    action: 'NONE',
                    status: 'FAILED',
                    errorCode: rowErr.code || 'ERR_INVALID_ROW_DATA',
                    errorMessage: rowErr.message || 'Row validation failed',
                  });
                  chunkFailed++;
                } else {
                  // Fatal database, infrastructure, or lock error -> abort entire chunk transaction
                  throw rowErr;
                }
              }
            }

            // Persist chunk row results
            await tx.productImportRowResult.createMany({
              data: chunkRowResults,
            });

            const isFinalChunk = k + 1 === totalChunks;
            const newCommittedChunk = k + 1;

            // Atomically update batch progress & checkpoint
            await tx.productImportBatch.update({
              where: { id: batch.id },
              data: {
                committedChunk: newCommittedChunk,
                processedRows: { increment: chunkSlice.length },
                successfulRows: { increment: chunkSuccess },
                failedRows: { increment: chunkFailed },
                status: isFinalChunk ? 'COMPLETED' : 'PROCESSING',
                completedAt: isFinalChunk ? new Date() : null,
              },
            });

            // Atomically advance lease checkpoint & extend heartbeat
            await tx.importExecutionLease.update({
              where: { id: 'GLOBAL_IMPORT_LEASE' },
              data: {
                currentChunk: newCommittedChunk,
                heartbeatAt: new Date(),
                expiresAt: new Date(Date.now() + 2 * 60 * 1000),
                status: isFinalChunk ? 'IDLE' : 'ACTIVE',
                batchId: isFinalChunk ? null : batch.id,
                ownerId: isFinalChunk ? null : actor.id,
              },
            });
          },
          {
            maxWait: 5000,
            timeout: 35000,
          }
        );
      }

      // Mark PARTIALLY_FAILED if any rows failed
      const finalBatch = await this.prisma.productImportBatch.findUnique({
        where: { id: batch.id },
        include: { results: true },
      });

      if (finalBatch && finalBatch.failedRows > 0 && finalBatch.status === 'COMPLETED') {
        await this.prisma.productImportBatch.update({
          where: { id: batch.id },
          data: { status: 'PARTIALLY_FAILED' },
        });
        finalBatch.status = 'PARTIALLY_FAILED';
      }

      return this.formatBatchResponse(finalBatch || batch);
    } catch (execErr: any) {
      this.logger.error(`Execution failed for batch ${batch.id}: ${execErr.message}`);
      // Release lease if worker errored
      await this.prisma.importExecutionLease.updateMany({
        where: { id: 'GLOBAL_IMPORT_LEASE', batchId: batch.id },
        data: { status: 'IDLE', batchId: null, ownerId: null },
      });
      throw execErr;
    }
  }

  /**
   * Processes a single normalized row inside an active chunk transaction.
   */
  private async executeSingleRowInsideTx(
    tx: Prisma.TransactionClient,
    row: NormalizedImportRow,
    config: {
      batchId: string;
      stockMode: 'SET_STOCK' | 'ADD_STOCK';
      allowUpdates: boolean;
      actorId: string;
    }
  ) {
    if (row.isVariant) {
      // -----------------------------------------------------------------------
      // Variant Execution
      // -----------------------------------------------------------------------
      if (!row.parentSku) {
        throw new BusinessValidationException(
          'ERR_INVALID_ROW_DATA',
          'Parent SKU is required for variant rows'
        );
      }

      const parent = await tx.product.findUnique({
        where: { sku: row.parentSku.toUpperCase() },
        include: { variants: true },
      });

      if (!parent) {
        throw new BusinessValidationException(
          'ERR_TARGET_ENTITY_DELETED',
          `Parent product with SKU "${row.parentSku}" not found in catalog`
        );
      }

      const targetSku = row.sku ? row.sku.toUpperCase() : null;

      if (targetSku) {
        const globalSku = await tx.globalSku.findUnique({
          where: { sku: targetSku },
        });

        if (globalSku) {
          if (!config.allowUpdates) {
            throw new BusinessValidationException(
              'ERR_SKU_EXISTS',
              `Variant SKU "${targetSku}" already exists and allowUpdates is disabled`
            );
          }

          if (globalSku.ownerType !== 'VARIANT' || !globalSku.variantId) {
            throw new BusinessValidationException(
              'ERR_SKU_OWNERSHIP_MISMATCH',
              `SKU "${targetSku}" is owned by a Product, not a Variant`
            );
          }

          // Pessimistic lock on target variant
          const lockedVars = await tx.$queryRaw<Array<{ id: string; updatedAt: Date }>>`
            SELECT id, "updatedAt"
            FROM "ProductVariant"
            WHERE id = ${globalSku.variantId}
            FOR UPDATE
          `;

          if (!lockedVars.length) {
            throw new BusinessValidationException(
              'ERR_TARGET_ENTITY_DELETED',
              `Target variant with SKU "${targetSku}" was deleted after preview`
            );
          }

          const liveVar = lockedVars[0];

          // Optimistic concurrency snapshot verification
          if (row.snapshot && row.snapshot.targetType === 'VARIANT') {
            if (new Date(liveVar.updatedAt).toISOString() !== row.snapshot.updatedAt) {
              throw new BusinessValidationException(
                'ERR_CONCURRENT_CATALOG_UPDATE',
                `Variant "${targetSku}" was modified by another administrator after preview generation`
              );
            }
          }

          // Apply variant updates
          const priceCents =
            row.variantPrice !== undefined && row.variantPrice !== null
              ? Math.round(row.variantPrice * 100)
              : undefined;

          await tx.productVariant.update({
            where: { id: liveVar.id },
            data: {
              name: row.variantName || row.name,
              ...(priceCents !== undefined ? { priceCents } : {}),
            },
          });

          // Stock adjustment
          if (this.inventoryService) {
            const stockVal = row.variantStock ?? row.stockQuantity;
            try {
              if (config.stockMode === 'ADD_STOCK' && stockVal > 0) {
                await this.inventoryService.adjustStockWithTx(
                  tx,
                  {
                    productId: parent.id,
                    variantId: liveVar.id,
                    delta: stockVal,
                    reason: InventoryChangeReason.RESTOCK,
                    note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
                  },
                  { id: config.actorId }
                );
              } else if (config.stockMode === 'SET_STOCK') {
                await this.inventoryService.adjustStockWithTx(
                  tx,
                  {
                    productId: parent.id,
                    variantId: liveVar.id,
                    targetQuantity: stockVal,
                    reason: InventoryChangeReason.CORRECTION,
                    note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
                  },
                  { id: config.actorId }
                );
              }
            } catch (invErr: any) {
              if (invErr.message?.includes('reserved') || invErr.message?.includes('reservation')) {
                throw new BusinessValidationException('ERR_RESERVED_STOCK_BREACH', invErr.message);
              }
              throw invErr;
            }
          }

          return {
            batchId: config.batchId,
            rowNumber: row.rowNumber,
            sku: targetSku,
            action: 'UPDATED_VARIANT',
            status: 'SUCCESS',
            productId: parent.id,
            variantId: liveVar.id,
          };
        } else {
          // Create variant with explicit SKU
          await this.skuGenerator.syncSequenceIfHigher(targetSku, tx);

          const priceCents =
            row.variantPrice !== undefined && row.variantPrice !== null
              ? Math.round(row.variantPrice * 100)
              : Math.round(row.sellingPrice * 100);

          const newVariant = await tx.productVariant.create({
            data: {
              productId: parent.id,
              sku: targetSku,
              name: row.variantName || row.name,
              priceCents,
              stockQuantity: 0, // Invariant: stock set via adjustStockWithTx
              attributes: row.color ? { color: row.color } : {},
            },
          });

          // Stock adjustment
          const stockVal = row.variantStock ?? row.stockQuantity;
          if (this.inventoryService && stockVal > 0) {
            await this.inventoryService.adjustStockWithTx(
              tx,
              {
                productId: parent.id,
                variantId: newVariant.id,
                delta: stockVal,
                reason: InventoryChangeReason.RESTOCK,
                note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
              },
              { id: config.actorId }
            );
          }

          return {
            batchId: config.batchId,
            rowNumber: row.rowNumber,
            sku: targetSku,
            action: 'CREATED_VARIANT',
            status: 'SUCCESS',
            productId: parent.id,
            variantId: newVariant.id,
          };
        }
      } else {
        // Create variant with auto-generated SKU
        const generatedVariantSku = await this.skuGenerator.generateVariantSku(
          parent.sku,
          { color: row.color },
          tx
        );

        const priceCents =
          row.variantPrice !== undefined && row.variantPrice !== null
            ? Math.round(row.variantPrice * 100)
            : Math.round(row.sellingPrice * 100);

        const newVariant = await tx.productVariant.create({
          data: {
            productId: parent.id,
            sku: generatedVariantSku,
            name: row.variantName || row.name,
            priceCents,
            stockQuantity: 0,
            attributes: row.color ? { color: row.color } : {},
          },
        });

        const stockVal = row.variantStock ?? row.stockQuantity;
        if (this.inventoryService && stockVal > 0) {
          await this.inventoryService.adjustStockWithTx(
            tx,
            {
              productId: parent.id,
              variantId: newVariant.id,
              delta: stockVal,
              reason: InventoryChangeReason.RESTOCK,
              note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
            },
            { id: config.actorId }
          );
        }

        return {
          batchId: config.batchId,
          rowNumber: row.rowNumber,
          sku: generatedVariantSku,
          action: 'CREATED_VARIANT',
          status: 'SUCCESS',
          productId: parent.id,
          variantId: newVariant.id,
        };
      }
    } else {
      // -----------------------------------------------------------------------
      // Standalone Product Execution
      // -----------------------------------------------------------------------
      if (!row.categoryId) {
        throw new BusinessValidationException('ERR_INVALID_ROW_DATA', 'Category ID is required');
      }
      if (!row.brandId) {
        throw new BusinessValidationException('ERR_INVALID_ROW_DATA', 'Brand ID is required');
      }

      // Verify category, subcategory, brand under locks
      const lockedCats = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
        SELECT id, "isActive" FROM "Category" WHERE id = ${row.categoryId} FOR UPDATE
      `;
      if (!lockedCats.length || !lockedCats[0].isActive) {
        throw new BusinessValidationException(
          'ERR_CATEGORY_INACTIVE_OR_DELETED',
          `Category "${row.categoryName}" is inactive or deleted`
        );
      }

      if (row.subcategoryId) {
        const lockedSubs = await tx.$queryRaw<
          Array<{ id: string; isActive: boolean; parentId: string | null }>
        >`
          SELECT id, "isActive", "parentId" FROM "Category" WHERE id = ${row.subcategoryId} FOR UPDATE
        `;
        if (
          !lockedSubs.length ||
          !lockedSubs[0].isActive ||
          lockedSubs[0].parentId !== row.categoryId
        ) {
          throw new BusinessValidationException(
            'ERR_SUBCATEGORY_INACTIVE_OR_DELETED',
            `Subcategory "${row.subcategoryName}" is inactive, deleted, or does not belong to category`
          );
        }
      }

      const lockedBrands = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
        SELECT id, "isActive" FROM "Brand" WHERE id = ${row.brandId} FOR UPDATE
      `;
      if (!lockedBrands.length || !lockedBrands[0].isActive) {
        throw new BusinessValidationException(
          'ERR_BRAND_INACTIVE_OR_DELETED',
          `Brand "${row.brandName}" is inactive or deleted`
        );
      }

      const targetSku = row.sku ? row.sku.toUpperCase() : null;

      if (targetSku) {
        const globalSku = await tx.globalSku.findUnique({
          where: { sku: targetSku },
        });

        if (globalSku) {
          if (!config.allowUpdates) {
            throw new BusinessValidationException(
              'ERR_SKU_EXISTS',
              `Product SKU "${targetSku}" already exists and allowUpdates is disabled`
            );
          }

          if (globalSku.ownerType !== 'PRODUCT' || !globalSku.productId) {
            throw new BusinessValidationException(
              'ERR_SKU_OWNERSHIP_MISMATCH',
              `SKU "${targetSku}" is owned by a Variant, not a Product`
            );
          }

          const lockedProds = await tx.$queryRaw<Array<{ id: string; updatedAt: Date }>>`
            SELECT id, "updatedAt" FROM "Product" WHERE id = ${globalSku.productId} FOR UPDATE
          `;

          if (!lockedProds.length) {
            throw new BusinessValidationException(
              'ERR_TARGET_ENTITY_DELETED',
              `Target product with SKU "${targetSku}" was deleted after preview`
            );
          }

          const liveProd = lockedProds[0];

          // Optimistic concurrency verification
          if (row.snapshot && row.snapshot.targetType === 'PRODUCT') {
            if (new Date(liveProd.updatedAt).toISOString() !== row.snapshot.updatedAt) {
              throw new BusinessValidationException(
                'ERR_CONCURRENT_CATALOG_UPDATE',
                `Product "${targetSku}" was modified by another administrator after preview generation`
              );
            }
          }

          // Apply product updates
          const priceCents = Math.round(row.sellingPrice * 100);
          const costPriceCents =
            row.costPrice !== undefined && row.costPrice !== null
              ? Math.round(row.costPrice * 100)
              : null;

          await tx.product.update({
            where: { id: liveProd.id },
            data: {
              name: row.name,
              priceCents,
              ...(costPriceCents !== null ? { costPriceCents } : {}),
              categoryId: row.categoryId,
              subcategoryId: row.subcategoryId || null,
              brandId: row.brandId,
              description: row.raw?.description || undefined,
              shortDescription: row.raw?.shortDescription || undefined,
              lowStockThreshold: row.lowStockThreshold || 5,
              barcode: row.barcode || undefined,
            },
          });

          // Stock adjustment
          if (this.inventoryService) {
            try {
              if (config.stockMode === 'ADD_STOCK' && row.stockQuantity > 0) {
                await this.inventoryService.adjustStockWithTx(
                  tx,
                  {
                    productId: liveProd.id,
                    delta: row.stockQuantity,
                    reason: InventoryChangeReason.RESTOCK,
                    note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
                  },
                  { id: config.actorId }
                );
              } else if (config.stockMode === 'SET_STOCK') {
                await this.inventoryService.adjustStockWithTx(
                  tx,
                  {
                    productId: liveProd.id,
                    targetQuantity: row.stockQuantity,
                    reason: InventoryChangeReason.CORRECTION,
                    note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
                  },
                  { id: config.actorId }
                );
              }
            } catch (invErr: any) {
              if (invErr.message?.includes('reserved') || invErr.message?.includes('reservation')) {
                throw new BusinessValidationException('ERR_RESERVED_STOCK_BREACH', invErr.message);
              }
              throw invErr;
            }
          }

          return {
            batchId: config.batchId,
            rowNumber: row.rowNumber,
            sku: targetSku,
            action: 'UPDATED_PRODUCT',
            status: 'SUCCESS',
            productId: liveProd.id,
          };
        } else {
          // Create new product with explicit SKU
          await this.skuGenerator.syncSequenceIfHigher(targetSku, tx);

          const baseSlug = (row.slug || row.name)
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/[\s-]+/g, '-');

          let slugCandidate = baseSlug;
          let suffix = 1;
          while (await tx.product.findUnique({ where: { slug: slugCandidate } })) {
            slugCandidate = `${baseSlug}-${suffix++}`;
          }

          const priceCents = Math.round(row.sellingPrice * 100);
          const costPriceCents =
            row.costPrice !== undefined && row.costPrice !== null
              ? Math.round(row.costPrice * 100)
              : null;

          const createdProd = await tx.product.create({
            data: {
              sku: targetSku,
              name: row.name,
              slug: slugCandidate,
              priceCents,
              costPriceCents,
              stockQuantity: 0, // Set through adjustStockWithTx
              categoryId: row.categoryId,
              subcategoryId: row.subcategoryId || null,
              brandId: row.brandId,
              description: row.raw?.description || '',
              shortDescription: row.raw?.shortDescription || '',
              lowStockThreshold: row.lowStockThreshold || 5,
              barcode: row.barcode || null,
              isFeatured: row.isFeatured || false,
            },
          });

          // Stock adjustment
          if (this.inventoryService && row.stockQuantity > 0) {
            await this.inventoryService.adjustStockWithTx(
              tx,
              {
                productId: createdProd.id,
                delta: row.stockQuantity,
                reason: InventoryChangeReason.RESTOCK,
                note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
              },
              { id: config.actorId }
            );
          }

          return {
            batchId: config.batchId,
            rowNumber: row.rowNumber,
            sku: targetSku,
            action: 'CREATED_PRODUCT',
            status: 'SUCCESS',
            productId: createdProd.id,
          };
        }
      } else {
        // Create new product with auto-generated SKU
        const generatedSku = await this.skuGenerator.generateProductSku(
          row.categoryId,
          row.brandId,
          tx
        );

        const baseSlug = (row.slug || row.name)
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/[\s-]+/g, '-');

        let slugCandidate = baseSlug;
        let suffix = 1;
        while (await tx.product.findUnique({ where: { slug: slugCandidate } })) {
          slugCandidate = `${baseSlug}-${suffix++}`;
        }

        const priceCents = Math.round(row.sellingPrice * 100);
        const costPriceCents =
          row.costPrice !== undefined && row.costPrice !== null
            ? Math.round(row.costPrice * 100)
            : null;

        const createdProd = await tx.product.create({
          data: {
            sku: generatedSku,
            name: row.name,
            slug: slugCandidate,
            priceCents,
            costPriceCents,
            stockQuantity: 0,
            categoryId: row.categoryId,
            subcategoryId: row.subcategoryId || null,
            brandId: row.brandId,
            description: row.raw?.description || '',
            shortDescription: row.raw?.shortDescription || '',
            lowStockThreshold: row.lowStockThreshold || 5,
            barcode: row.barcode || null,
            isFeatured: row.isFeatured || false,
          },
        });

        if (this.inventoryService && row.stockQuantity > 0) {
          await this.inventoryService.adjustStockWithTx(
            tx,
            {
              productId: createdProd.id,
              delta: row.stockQuantity,
              reason: InventoryChangeReason.RESTOCK,
              note: `Excel/CSV Import Batch: ${config.batchId} (Row ${row.rowNumber})`,
            },
            { id: config.actorId }
          );
        }

        return {
          batchId: config.batchId,
          rowNumber: row.rowNumber,
          sku: generatedSku,
          action: 'CREATED_PRODUCT',
          status: 'SUCCESS',
          productId: createdProd.id,
        };
      }
    }
  }

  /**
   * Identifies recoverable row-level business validation exceptions.
   */
  private isRecoverableRowError(err: any): boolean {
    if (err instanceof BusinessValidationException) return true;
    if (err?.name === 'BusinessValidationException') return true;
    if (err instanceof BadRequestException) return true;
    if (err?.status === 400) return true;
    return false;
  }

  /**
   * Formats a batch database model for client API responses.
   */
  private formatBatchResponse(batch: any) {
    return {
      batchId: batch.id,
      idempotencyKey: batch.idempotencyKey,
      previewId: batch.previewId,
      stockMode: batch.stockMode,
      allowUpdates: batch.allowUpdates,
      status: batch.status,
      totalRows: batch.totalRows,
      totalChunks: batch.totalChunks,
      committedChunk: batch.committedChunk,
      processedRows: batch.processedRows,
      successfulRows: batch.successfulRows,
      failedRows: batch.failedRows,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
      rowResults: batch.results || [],
    };
  }

  /**
   * Retrieves batch execution status and progress counters.
   */
  async getBatchStatus(batchId: string, actor: { id: string; role?: string }) {
    const batch = await this.prisma.productImportBatch.findUnique({
      where: { id: batchId },
      include: {
        results: {
          orderBy: { rowNumber: 'asc' },
          take: 500, // Return first 500 results for dashboard display
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Import batch "${batchId}" not found`);
    }

    if (actor.role !== 'ADMIN' && batch.adminId !== actor.id) {
      throw new ForbiddenException('Forbidden: Access denied to batch details');
    }

    return this.formatBatchResponse(batch);
  }

  /**
   * Generates a downloadable CSV or Excel error report for an executed batch.
   */
  async getBatchErrorReport(
    batchId: string,
    actor: { id: string; role?: string },
    format: 'csv' | 'xlsx'
  ): Promise<Buffer> {
    const batch = await this.prisma.productImportBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException(`Import batch "${batchId}" not found`);
    }

    if (actor.role !== 'ADMIN' && batch.adminId !== actor.id) {
      throw new ForbiddenException('Forbidden: Access denied to error report');
    }

    const failedResults = await this.prisma.productImportRowResult.findMany({
      where: { batchId, status: 'FAILED' },
      orderBy: { rowNumber: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DSL Stationery E-commerce';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Batch Errors');
    worksheet.columns = [
      { header: 'Row Number', key: 'rowNumber', width: 14 },
      { header: 'SKU', key: 'sku', width: 22 },
      { header: 'Action Attempted', key: 'action', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Error Code', key: 'errorCode', width: 32 },
      { header: 'Error Message', key: 'errorMessage', width: 60 },
      { header: 'Timestamp', key: 'createdAt', width: 25 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF991B1B' }, // Dark Red
    };
    headerRow.height = 26;

    for (const r of failedResults) {
      worksheet.addRow({
        rowNumber: r.rowNumber,
        sku: r.sku || 'N/A',
        action: r.action,
        status: r.status,
        errorCode: r.errorCode || 'UNKNOWN',
        errorMessage: r.errorMessage || 'Unknown failure',
        createdAt: r.createdAt.toISOString(),
      });
    }

    if (format === 'csv') {
      const csvBuffer = await workbook.csv.writeBuffer();
      return Buffer.from(csvBuffer);
    }

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(xlsxBuffer);
  }

  /**
   * Retrieves paginated product import history for the administrator dashboard.
   */
  async getImportHistory(
    actor: { id: string; role?: string },
    query: { page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where = actor.role === 'ADMIN' ? {} : { adminId: actor.id };

    const [totalItems, batches] = await Promise.all([
      this.prisma.productImportBatch.count({ where }),
      this.prisma.productImportBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const items = batches.map((b) => ({
      ...this.formatBatchResponse(b),
      adminName: b.admin?.name || 'Administrator',
      adminEmail: b.admin?.email || '',
    }));

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }
}
