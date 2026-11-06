import { Injectable, Logger } from '@nestjs/common';
import { OcrVisionProvider, OcrExtractionResult, ExtractedLineItem } from './ocr-provider.interface';

@Injectable()
export class SimulatedOcrProvider implements OcrVisionProvider {
  readonly providerName = 'SIMULATED_VISION_OCR';
  private readonly logger = new Logger(SimulatedOcrProvider.name);

  // Default stationery item templates when processing an image/document without textual content
  private readonly defaultSimulatedItems: ExtractedLineItem[] = [
    {
      rawText: 'Atlas CR Book 120 Pages - 5 nos',
      cleanDescription: 'Atlas CR Book 120 Pages',
      quantity: 5,
      unit: 'nos',
      extractionConfidence: 0.96,
    },
    {
      rawText: 'DOMS Coloured Fragrance Eraser 20Pcs (1 box)',
      cleanDescription: 'DOMS Coloured Fragrance Eraser 20Pcs',
      quantity: 1,
      unit: 'box',
      extractionConfidence: 0.94,
    },
    {
      rawText: 'Speed Fabric Paint Deep Green 108 - 2 pcs',
      cleanDescription: 'Speed Fabric Paint Deep Green 108',
      quantity: 2,
      unit: 'pcs',
      extractionConfidence: 0.91,
    },
    {
      rawText: 'Maped Sharpener Shaker 1 Hole - 3 nos',
      cleanDescription: 'Maped Sharpener Shaker 1 Hole',
      quantity: 3,
      unit: 'nos',
      extractionConfidence: 0.88,
    },
    {
      rawText: 'Vintage Japanese Calligraphy Brush 10mm (Unmatched specialty)',
      cleanDescription: 'Vintage Japanese Calligraphy Brush 10mm',
      quantity: 1,
      unit: 'nos',
      extractionConfidence: 0.65,
    },
  ];

  /**
   * Parse arbitrary text lines into structured line items
   */
  parseTextLines(text: string): ExtractedLineItem[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    const items: ExtractedLineItem[] = [];

    for (const line of lines) {
      // Regex to capture optional quantity and unit e.g.:
      // "Atlas Notebook 80 pgs - 4 pcs" or "3x Doms Eraser" or "2 packs of pens"
      const quantityPrefixMatch = line.match(/^(\d+)\s*(?:x|pcs|packs?|boxes|box|nos|units?)\s+(.+)$/i);
      const quantitySuffixMatch = line.match(/^(.+?)(?:\s*[-–:]\s*|\s+)(\d+)\s*(pcs|packs?|boxes|box|nos|units?|reams?)?$/i);

      let cleanDesc = line;
      let quantity = 1;
      let unit = 'nos';

      if (quantityPrefixMatch) {
        quantity = parseInt(quantityPrefixMatch[1], 10) || 1;
        cleanDesc = quantityPrefixMatch[2].trim();
      } else if (quantitySuffixMatch) {
        cleanDesc = quantitySuffixMatch[1].trim();
        quantity = parseInt(quantitySuffixMatch[2], 10) || 1;
        if (quantitySuffixMatch[3]) {
          unit = quantitySuffixMatch[3].trim().toLowerCase();
        }
      }

      // Compute heuristic confidence based on clarity and length
      let confidence = 0.9;
      if (cleanDesc.length < 5) confidence = 0.6;
      if (/[?*%$]/.test(cleanDesc)) confidence = 0.7;

      items.push({
        rawText: line,
        cleanDescription: cleanDesc,
        quantity: Math.max(1, quantity),
        unit,
        extractionConfidence: Number(confidence.toFixed(2)),
      });
    }

    return items;
  }

  async extractItems(
    fileBuffer: Buffer,
    mimeType: string,
    options?: { customerNotes?: string }
  ): Promise<OcrExtractionResult> {
    this.logger.log(`Executing simulated OCR extraction for mime: ${mimeType}`);

    // If customer provided explicit list notes in upload form, parse those
    if (options?.customerNotes && options.customerNotes.trim().length > 0) {
      const parsedItems = this.parseTextLines(options.customerNotes);
      if (parsedItems.length > 0) {
        return {
          items: parsedItems,
          rawOcrText: options.customerNotes,
          providerName: this.providerName,
          isSimulated: true,
        };
      }
    }

    // For PDF files, check if text is extractable directly from binary buffer
    if (mimeType === 'application/pdf') {
      try {
        const textContent = fileBuffer.toString('utf-8');
        // Simple heuristic: check if common words or line breaks appear
        if (textContent.includes('BT') && textContent.includes('ET')) {
          // Has PDF text streams, or fall back to default simulated items
        }
      } catch {
        // Fall back
      }
    }

    // Return the realistic default list
    return {
      items: this.defaultSimulatedItems,
      rawOcrText: this.defaultSimulatedItems.map((i) => i.rawText).join('\n'),
      providerName: this.providerName,
      isSimulated: true,
    };
  }
}

