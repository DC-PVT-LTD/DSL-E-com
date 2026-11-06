export interface ExtractedLineItem {
  rawText: string;
  cleanDescription: string;
  quantity: number;
  unit?: string;
  extractionConfidence: number; // 0.0 to 1.0
}

export interface OcrExtractionResult {
  items: ExtractedLineItem[];
  rawOcrText?: string;
  providerName: string;
  isSimulated: boolean;
}

export interface OcrVisionProvider {
  readonly providerName: string;
  extractItems(
    fileBuffer: Buffer,
    mimeType: string,
    options?: { customerNotes?: string }
  ): Promise<OcrExtractionResult>;
}

