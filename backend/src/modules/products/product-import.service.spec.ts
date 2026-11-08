import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ExcelJS from 'exceljs';
import { ProductImportService } from './product-import.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SkuGeneratorService } from './sku-generator.service';

describe('ProductImportService (Stage 3)', () => {
  let service: ProductImportService;
  let mockPrisma: any;
  let mockSkuGenerator: any;

  const mockCategories = [
    { id: 'cat-pens', name: 'Writing Instruments', slug: 'writing-instruments', parentId: null },
    { id: 'sub-ballpoint', name: 'Ballpoint Pens', slug: 'ballpoint-pens', parentId: 'cat-pens' },
    { id: 'sub-gel', name: 'Gel Pens', slug: 'gel-pens', parentId: 'cat-pens' },
    { id: 'cat-books', name: 'Books & Exercise Books', slug: 'books-exercise-books', parentId: null },
    { id: 'sub-cr', name: 'CR Books', slug: 'cr-books', parentId: 'cat-books' },
  ];

  const mockBrands = [
    { id: 'brd-atlas', name: 'Atlas', slug: 'atlas' },
    { id: 'brd-natraj', name: 'Natraj', slug: 'natraj' },
    { id: 'brd-mango', name: 'Mango', slug: 'mango' },
  ];

  const mockGlobalSkus = [
    { sku: 'EXISTING-PROD-SKU-001', ownerType: 'PRODUCT', productId: 'p-1', variantId: null },
    { sku: 'EXISTING-VAR-SKU-001', ownerType: 'VARIANT', productId: null, variantId: 'v-1' },
  ];

  beforeEach(() => {
    mockPrisma = {
      category: {
        findMany: vi.fn().mockResolvedValue(mockCategories),
      },
      brand: {
        findMany: vi.fn().mockResolvedValue(mockBrands),
      },
      globalSku: {
        findMany: vi.fn().mockImplementation(async ({ where }) => {
          const skus: string[] = where?.sku?.in || [];
          return mockGlobalSkus.filter((gs) => skus.includes(gs.sku));
        }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    mockSkuGenerator = {
      getCategoryCode: vi.fn((slug) => (slug.includes('writ') ? 'WRI' : 'CAT')),
      getBrandCode: vi.fn((slug) => (slug.includes('atl') ? 'ATL' : 'BRD')),
      getColorCode: vi.fn((c) => (c.toUpperCase() === 'BLUE' ? 'BLU' : 'RED')),
    };

    service = new ProductImportService(
      mockPrisma as unknown as PrismaService,
      mockSkuGenerator as unknown as SkuGeneratorService
    );
  });

  describe('1. Template Generation', () => {
    it('should generate a valid downloadable Excel template with headers and instructions', async () => {
      const buffer = await service.generateTemplate('xlsx');
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.worksheets[0].name).toBe('Product Template');
      expect(workbook.worksheets[1].name).toBe('Instructions & Field Guide');

      const templateSheet = workbook.worksheets[0];
      const headerValues: string[] = [];
      templateSheet.getRow(1).eachCell((c) => headerValues.push(String(c.value)));
      expect(headerValues).toContain('Product Name *');
      expect(headerValues).toContain('Selling Price (LKR) *');
      expect(headerValues).toContain('Stock Quantity *');
      expect(templateSheet.rowCount).toBeGreaterThan(2); // Headers + sample rows
    });

    it('should generate a valid downloadable CSV template', async () => {
      const buffer = await service.generateTemplate('csv');
      expect(buffer).toBeDefined();
      const csvStr = buffer.toString('utf-8');
      expect(csvStr).toContain('Product Name *');
      expect(csvStr).toContain('Writing Instruments');
      expect(csvStr).toContain('Atlas');
    });
  });

  describe('2. Excel and CSV Parsing', () => {
    it('should parse a valid CSV file with products and variants', async () => {
      const csvContent = `SKU,Product Name *,Category *,Subcategory,Brand *,Selling Price (LKR) *,Stock Quantity *,Description
DSL-PEN-ATL-001,Atlas Chooty Blue,Writing Instruments,Ballpoint Pens,Atlas,60.00,100,Blue pen
DSL-NOT-MNG-001,Mango Exercise Book,Books & Exercise Books,CR Books,Mango,250.00,50,CR book`;

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'products.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent, 'utf-8'),
        size: csvContent.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.totalRows).toBe(2);
      expect(result.summary.validRows).toBe(2);
      expect(result.summary.invalidRows).toBe(0);
      expect(result.rows[0].name).toBe('Atlas Chooty Blue');
      expect(result.rows[0].sellingPrice).toBe(60);
      expect(result.rows[0].stockQuantity).toBe(100);
      expect(result.rows[0].status).toBe('VALID');
      expect(result.rows[1].status).toBe('VALID');
    });

    it('should parse a valid Excel workbook with products', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Products');
      sheet.addRow(['SKU', 'Product Name *', 'Category *', 'Subcategory', 'Brand *', 'Selling Price (LKR) *', 'Stock Quantity *']);
      sheet.addRow(['DSL-TEST-001', 'Test Pen', 'Writing Instruments', 'Ballpoint Pens', 'Atlas', 55.0, 75]);

      const buffer = await workbook.xlsx.writeBuffer();
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test_products.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(buffer),
        size: buffer.byteLength,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.totalRows).toBe(1);
      expect(result.summary.validRows).toBe(1);
      expect(result.rows[0].name).toBe('Test Pen');
      expect(result.rows[0].sellingPrice).toBe(55);
      expect(result.rows[0].stockQuantity).toBe(75);
      expect(result.rows[0].status).toBe('VALID');
    });
  });

  describe('3. Validation Rules', () => {
    it('should catch missing required fields (name, category, brand, sellingPrice, stockQuantity)', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
DSL-01,,Writing Instruments,Atlas,60,100
DSL-02,No Category,,Atlas,60,100
DSL-03,No Brand,Writing Instruments,,60,100
DSL-04,No Price,Writing Instruments,Atlas,,100
DSL-05,No Stock,Writing Instruments,Atlas,60,`;

      const mockFile = {
        originalname: 'missing.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.totalRows).toBe(5);
      expect(result.summary.invalidRows).toBe(5);
      expect(result.rows[0].errors).toContain('Product name is required');
      expect(result.rows[1].errors).toContain('Category is required');
      expect(result.rows[2].errors).toContain('Brand is required');
      expect(result.rows[3].errors).toContain('Selling price is required');
      expect(result.rows[4].errors).toContain('Stock quantity is required');
    });

    it('should catch invalid prices (<= 0) and invalid non-integer stock quantities', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Cost Price (LKR),Stock Quantity *
DSL-01,Negative Price,Writing Instruments,Atlas,-50,20,100
DSL-02,Zero Price,Writing Instruments,Atlas,0,20,100
DSL-03,Negative Stock,Writing Instruments,Atlas,60,40,-10
DSL-04,Decimal Stock,Writing Instruments,Atlas,60,40,12.5
DSL-05,Negative Cost,Writing Instruments,Atlas,60,-15,100`;

      const mockFile = {
        originalname: 'invalid_numbers.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.invalidRows).toBe(5);
      expect(result.rows[0].errors.some((e) => e.includes('Invalid selling price'))).toBe(true);
      expect(result.rows[1].errors.some((e) => e.includes('Invalid selling price'))).toBe(true);
      expect(result.rows[2].errors.some((e) => e.includes('Invalid stock quantity'))).toBe(true);
      expect(result.rows[3].errors.some((e) => e.includes('Invalid stock quantity'))).toBe(true);
      expect(result.rows[4].errors.some((e) => e.includes('Invalid cost price'))).toBe(true);
    });

    it('should warn when selling price is lower than cost price without rejecting row', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Cost Price (LKR),Stock Quantity *
DSL-LOSS,Loss Leader Item,Writing Instruments,Atlas,50.00,80.00,20`;

      const mockFile = {
        originalname: 'loss.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.invalidRows).toBe(0);
      expect(result.summary.warningRows).toBe(1);
      expect(result.rows[0].status).toBe('WARNING');
      expect(result.rows[0].warnings.some((w) => w.includes('lower than cost price'))).toBe(true);
    });

    it('should detect duplicate SKUs within the uploaded file', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
DUPLICATE-SKU-99,First Product,Writing Instruments,Atlas,60,100
OTHER-SKU-01,Middle Product,Writing Instruments,Atlas,70,50
DUPLICATE-SKU-99,Duplicate Product,Books & Exercise Books,Mango,120,30`;

      const mockFile = {
        originalname: 'dupes.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.duplicateRows).toBe(2);
      expect(result.rows[0].status).toBe('DUPLICATE_IN_FILE');
      expect(result.rows[2].status).toBe('DUPLICATE_IN_FILE');
      expect(result.rows[0].errors.some((e) => e.includes('Duplicate SKU'))).toBe(true);
      expect(result.rows[2].errors.some((e) => e.includes('Duplicate SKU'))).toBe(true);
      expect(result.rows[1].status).toBe('VALID');
    });

    it('should detect existing SKUs in the database via GlobalSku', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
EXISTING-PROD-SKU-001,Updated Pen,Writing Instruments,Atlas,65,200
NEW-SKU-100,Brand New Pen,Writing Instruments,Atlas,80,50`;

      const mockFile = {
        originalname: 'existing.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.existingRows).toBe(1);
      expect(result.rows[0].status).toBe('EXISTS_IN_DB');
      expect(result.rows[0].isExisting).toBe(true);
      expect(result.rows[0].warnings.some((w) => w.includes('already exists in database'))).toBe(true);
      expect(result.rows[1].status).toBe('VALID');
      expect(result.rows[1].isExisting).toBe(false);
    });

    it('should reject category and subcategory mismatches', async () => {
      const csvContent = `SKU,Product Name *,Category *,Subcategory,Brand *,Selling Price (LKR) *,Stock Quantity *
DSL-01,Mismatched Subcategory,Writing Instruments,CR Books,Atlas,60,100
DSL-02,Non Existent Category,Alien Category,,Atlas,60,100
DSL-03,Non Existent Subcategory,Writing Instruments,Fake Subcat,Atlas,60,100`;

      const mockFile = {
        originalname: 'bad_cats.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.invalidRows).toBe(3);
      expect(result.rows[0].errors.some((e) => e.includes('does not belong to category'))).toBe(true);
      expect(result.rows[1].errors.some((e) => e.includes('not found in database'))).toBe(true);
      expect(result.rows[2].errors.some((e) => e.includes('not found in database'))).toBe(true);
    });

    it('should reject invalid brand names', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
DSL-01,Bad Brand Item,Writing Instruments,Unknown Brand Corp,60,100`;

      const mockFile = {
        originalname: 'bad_brand.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.invalidRows).toBe(1);
      expect(result.rows[0].errors.some((e) => e.includes('Brand "Unknown Brand Corp" not found'))).toBe(true);
    });

    it('should validate variant information and reject missing parent SKU', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *,Variant Name,Parent SKU,Color
DSL-ORPHAN,Orphan Variant,Writing Instruments,Atlas,60,100,Red Ink,NON-EXISTENT-PARENT-SKU,Red`;

      const mockFile = {
        originalname: 'orphan_variant.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.invalidRows).toBe(1);
      expect(result.rows[0].errors.some((e) => e.includes('Parent SKU "NON-EXISTENT-PARENT-SKU" not found'))).toBe(true);
    });

    it('should auto-propose sequential SKU preview when SKU is omitted', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
,Atlas Chooty Blue,Writing Instruments,Atlas,60,100`;

      const mockFile = {
        originalname: 'auto_sku.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.rows[0].sku).toBeNull();
      expect(result.rows[0].proposedSku).toBe('DSL-WRI-ATL-XXXXX');
      expect(result.rows[0].status).toBe('VALID');
    });
  });

  describe('4. File Size Limits & Edge Cases', () => {
    it('should reject files exceeding 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const mockFile = {
        originalname: 'too_large.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: largeBuffer,
      } as Express.Multer.File;

      await expect(service.parseAndValidate(mockFile)).rejects.toThrow('exceeds the maximum allowed size of 10MB');
    });

    it('should reject empty files', async () => {
      const emptyFile = {
        originalname: 'empty.csv',
        mimetype: 'text/csv',
        buffer: Buffer.alloc(0),
      } as Express.Multer.File;

      await expect(service.parseAndValidate(emptyFile)).rejects.toThrow('uploaded file is empty');
    });

    it('should handle file with only headers gracefully (0 data rows)', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *`;
      const mockFile = {
        originalname: 'only_headers.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      const result = await service.parseAndValidate(mockFile);
      expect(result.summary.totalRows).toBe(0);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('5. Database Modification Strict Guarantee', () => {
    it('should NEVER create or update products, variants, or modify stock during preview', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
DSL-IMMUTABLE-01,Test Safe Product,Writing Instruments,Atlas,60,100`;

      const mockFile = {
        originalname: 'safe.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from(csvContent),
      } as Express.Multer.File;

      await service.parseAndValidate(mockFile);

      expect(mockPrisma.product.create).not.toHaveBeenCalled();
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
      expect(mockPrisma.productVariant.create).not.toHaveBeenCalled();
      expect(mockPrisma.productVariant.update).not.toHaveBeenCalled();
    });
  });

  describe('6. Error Report Generation', () => {
    it('should generate a downloadable CSV error report with error reasons and status columns', async () => {
      const mockRows: any[] = [
        {
          rowNumber: 2,
          status: 'INVALID',
          errors: ['Product name is required', 'Brand "BadBrand" not found in database'],
          warnings: [],
          sku: 'BAD-01',
          name: '',
          categoryName: 'Writing Instruments',
          brandName: 'BadBrand',
          sellingPrice: 60,
          stockQuantity: 100,
        },
      ];

      const buffer = await service.generateErrorReport(mockRows, 'csv');
      expect(buffer).toBeDefined();
      const csvStr = buffer.toString('utf-8');
      expect(csvStr).toContain('Validation Errors');
      expect(csvStr).toContain('Product name is required');
      expect(csvStr).toContain('BadBrand');
    });

    it('should generate a downloadable Excel error report with error reasons and status columns', async () => {
      const mockRows: any[] = [
        {
          rowNumber: 2,
          status: 'INVALID',
          errors: ['Selling price is required'],
          warnings: ['Selling price lower than cost price'],
          sku: 'BAD-02',
          name: 'Faulty Pen',
          categoryName: 'Writing Instruments',
          brandName: 'Atlas',
          sellingPrice: 0,
          stockQuantity: 100,
        },
      ];

      const buffer = await service.generateErrorReport(mockRows, 'xlsx');
      expect(buffer).toBeDefined();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      expect(workbook.worksheets[0].name).toBe('Validation Report');
      expect(workbook.worksheets[0].rowCount).toBe(2);
    });
  });
});
