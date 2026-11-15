import { apiClient } from '@/lib/api/apiClient';

export interface BulkOrderSearchResult {
  id: string;
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stockQuantity: number;
  images: string[];
  categoryName?: string;
  brandName?: string;
  isVariant: boolean;
  variantName?: string;
  isActive: boolean;
}

export interface ValidatedBulkOrderItem {
  rowNumber?: number;
  sku: string;
  name?: string;
  productId?: string;
  variantId?: string | null;
  requestedQuantity: number;
  availableStock: number;
  unitPriceCents: number;
  totalPriceCents: number;
  isValid: boolean;
  error?: string;
  images?: string[];
  categoryName?: string;
  brandName?: string;
}

export interface BulkOrderValidationResponse {
  items: ValidatedBulkOrderItem[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalQuantity: number;
  estimatedSubtotalCents: number;
}

export interface ParsedCsvRow {
  rowNumber: number;
  sku: string;
  name?: string;
  quantity: number;
  parseError?: string;
}

class BulkOrderService {
  /**
   * Search catalog products and variants by SKU, Name, or Barcode
   */
  public async search(query = ''): Promise<BulkOrderSearchResult[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: BulkOrderSearchResult[] }>(
        '/bulk-order/search',
        {
          params: { q: query.trim() },
        }
      );
      return res.data || [];
    } catch (err) {
      console.warn('Bulk order search failed:', err);
      return [];
    }
  }

  /**
   * Validate an array of SKU and Quantity pairs against PostgreSQL database
   */
  public async validate(
    items: Array<{ sku: string; quantity: number; rowNumber?: number }>
  ): Promise<BulkOrderValidationResponse> {
    const res = await apiClient.post<{ success: boolean; data: BulkOrderValidationResponse }>(
      '/bulk-order/validate',
      { items }
    );
    return res.data;
  }

  /**
   * Parse a raw CSV file into structured rows
   */
  public parseCsv(csvText: string): { rows: ParsedCsvRow[]; errors: string[] } {
    const lines = csvText
      .split(/\r\n|\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const errors: string[] = [];
    if (lines.length === 0) {
      return { rows: [], errors: ['Uploaded CSV file is completely empty.'] };
    }

    // Inspect header row
    const headerLine = lines[0];
    const headers = this.parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());

    let skuIndex = headers.findIndex((h) => h === 'sku' || h.includes('sku') || h.includes('code'));
    let qtyIndex = headers.findIndex((h) => h === 'quantity' || h === 'qty' || h.includes('count'));
    let nameIndex = headers.findIndex((h) => h === 'product name' || h === 'name' || h.includes('product'));

    // Default column fallback if header is missing
    if (skuIndex === -1 && headers.length >= 2) {
      skuIndex = 0;
      qtyIndex = headers.length >= 3 ? 2 : 1;
      nameIndex = headers.length >= 3 ? 1 : -1;
    }

    if (skuIndex === -1 || qtyIndex === -1) {
      return {
        rows: [],
        errors: [
          'CSV header must contain "SKU" and "Quantity" columns. Example: SKU, Product Name, Quantity',
        ],
      };
    }

    const rows: ParsedCsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length === 0 || values.every((v) => !v.trim())) continue;

      const rowNumber = i + 1;
      const sku = (values[skuIndex] || '').trim();
      const rawQty = (values[qtyIndex] || '').trim();
      const name = nameIndex > -1 ? (values[nameIndex] || '').trim() : undefined;

      let parseError: string | undefined;
      const parsedQty = parseInt(rawQty, 10);

      if (!sku) {
        parseError = 'SKU is missing in this row';
      } else if (isNaN(parsedQty) || parsedQty <= 0) {
        parseError = `Invalid quantity "${rawQty}". Must be an integer >= 1`;
      }

      rows.push({
        rowNumber,
        sku,
        name,
        quantity: isNaN(parsedQty) ? 0 : parsedQty,
        parseError,
      });
    }

    if (rows.length === 0) {
      errors.push('No valid data rows found in the uploaded CSV.');
    }

    return { rows, errors };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  /**
   * Trigger direct browser download of the standard CSV template
   */
  public downloadTemplate(): void {
    const csvContent =
      'SKU,Product Name,Quantity\n' +
      'DSL-SPEED-RIM-BLUE,SPEED RIM Ball Pen Blue,50\n' +
      'DSL-DOMS-COLOUR-12,Doms 12 Colour Pencils Set,30\n' +
      'DSL-AMIGO-FX82MS,MI FX82MS - CALCULATOR,15\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'dsl_bulk_order_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export currently listed items into a CSV file
   */
  public exportItemsToCsv(
    items: Array<{ sku: string; name?: string; quantity: number }>
  ): void {
    let csvContent = 'SKU,Product Name,Quantity\n';
    for (const item of items) {
      const safeName = (item.name || '').replace(/"/g, '""');
      csvContent += `"${item.sku}","${safeName}",${item.quantity}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'dsl_bulk_order_list.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const bulkOrderService = new BulkOrderService();
