import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OcrVisionProvider,
  OcrExtractionResult,
  ExtractedLineItem,
} from './ocr-provider.interface';
import { SimulatedOcrProvider } from './simulated-ocr.provider';

interface GoogleVisionImageAnnotationResponse {
  responses?: Array<{
    fullTextAnnotation?: {
      text: string;
      pages?: Array<{
        confidence?: number;
      }>;
    };
    error?: {
      code: number;
      message: string;
      status: string;
    };
  }>;
}

interface GoogleVisionFileAnnotationResponse {
  responses?: Array<{
    responses?: Array<{
      fullTextAnnotation?: {
        text: string;
        pages?: Array<{
          confidence?: number;
        }>;
      };
      error?: {
        code: number;
        message: string;
        status: string;
      };
    }>;
    error?: {
      code: number;
      message: string;
    };
  }>;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status?: string;
  };
}

export type VisionProviderType = 'google_vision' | 'gemini_vision' | 'simulated' | 'auto';

@Injectable()
export class RealVisionOcrProvider implements OcrVisionProvider {
  readonly providerName = 'REAL_VISION_OCR';
  private readonly logger = new Logger(RealVisionOcrProvider.name);

  private readonly rawProviderMode: VisionProviderType;
  private readonly googleVisionApiKey: string | undefined;
  private readonly geminiApiKey: string | undefined;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly nodeEnv: string;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly simulatedFallback?: SimulatedOcrProvider
  ) {
    this.rawProviderMode = (this.configService?.get<string>('OCR_PROVIDER') ||
      process.env.OCR_PROVIDER ||
      'auto') as VisionProviderType;

    const genericKey = this.configService?.get<string>('OCR_API_KEY') || process.env.OCR_API_KEY;
    this.googleVisionApiKey =
      this.configService?.get<string>('GOOGLE_VISION_API_KEY') ||
      process.env.GOOGLE_VISION_API_KEY ||
      genericKey;
    this.geminiApiKey =
      this.configService?.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      genericKey;

    this.maxRetries = this.configService?.get<number>('OCR_MAX_RETRIES') || 3;
    this.timeoutMs = this.configService?.get<number>('OCR_TIMEOUT_MS') || 15000;
    this.nodeEnv = this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';
  }

  /**
   * Determine the effective provider to use based on configuration and available keys
   */
  public resolveEffectiveProvider(): {
    provider: 'google_vision' | 'gemini_vision' | 'simulated';
    key?: string;
  } {
    if (this.rawProviderMode === 'simulated') {
      return { provider: 'simulated' };
    }

    if (this.rawProviderMode === 'google_vision') {
      if (!this.googleVisionApiKey) {
        throw new BadRequestException(
          '[OCR_CONFIG_ERROR] Google Cloud Vision was explicitly selected (OCR_PROVIDER=google_vision), but GOOGLE_VISION_API_KEY is not configured.'
        );
      }
      return { provider: 'google_vision', key: this.googleVisionApiKey };
    }

    if (this.rawProviderMode === 'gemini_vision') {
      if (!this.geminiApiKey) {
        throw new BadRequestException(
          '[OCR_CONFIG_ERROR] Gemini Vision was explicitly selected (OCR_PROVIDER=gemini_vision), but GEMINI_API_KEY is not configured.'
        );
      }
      return { provider: 'gemini_vision', key: this.geminiApiKey };
    }

    // Auto resolution
    if (this.geminiApiKey) {
      return { provider: 'gemini_vision', key: this.geminiApiKey };
    }
    if (this.googleVisionApiKey) {
      return { provider: 'google_vision', key: this.googleVisionApiKey };
    }

    // No keys configured
    if (this.nodeEnv === 'production') {
      throw new BadRequestException(
        '[OCR_CONFIG_ERROR] Real Vision OCR is required in production, but no API key (GEMINI_API_KEY or GOOGLE_VISION_API_KEY) was found.'
      );
    }

    return { provider: 'simulated' };
  }

  /**
   * Parse extracted raw text lines into structured line items
   */
  private parseTextToItems(
    rawText: string,
    overallConfidence = 0.90
  ): ExtractedLineItem[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !/^page\s+\d+/i.test(l));

    const items: ExtractedLineItem[] = [];

    for (const line of lines) {
      // Ignore metadata and invoice headers
      if (/^(total|date|subtotal|receipt|invoice|thank you|contact|tel|phone|grade\s*\d+|term\s*\d+|dsl|booklist)/i.test(line)) {
        continue;
      }

      const quantityPrefixMatch = line.match(/^(\d+)\s*(?:x|pcs|packs?|boxes|box|nos|units?)\s+(.+)$/i);
      const quantitySuffixMatch = line.match(/^(.+?)(?:\s*[-–:]\s*|\s+)(\d+)\s*(pcs|packs?|boxes|box|nos|units?|reams?|bottles?)?$/i);

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

      cleanDesc = cleanDesc.replace(/^[\d+.)\-*•\s]+/, '').trim();
      if (cleanDesc.length < 2) continue;

      let lineConfidence = overallConfidence;
      if (cleanDesc.length < 5) lineConfidence = Math.min(lineConfidence, 0.65);
      if (/[?*%$~]/.test(cleanDesc)) lineConfidence = Math.min(lineConfidence, 0.60);

      items.push({
        rawText: line,
        cleanDescription: cleanDesc,
        quantity: Math.max(1, quantity),
        unit,
        extractionConfidence: Number(lineConfidence.toFixed(2)),
      });
    }

    return items;
  }

  /**
   * PDF text stream parser for unencrypted digital PDFs
   */
  private extractTextFromPdfBuffer(buffer: Buffer): string | null {
    try {
      const content = buffer.toString('binary');
      const textMatches: string[] = [];
      const btEtRegex = /BT[\s\S]*?ET/g;
      const matches = content.match(btEtRegex);

      if (matches && matches.length > 0) {
        for (const block of matches) {
          const tjMatches = block.match(/\((.*?)\)\s*Tj/g);
          if (tjMatches) {
            for (const tj of tjMatches) {
              const text = tj.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim();
              if (text.length > 0) textMatches.push(text);
            }
          }
        }
      }

      if (textMatches.length >= 2) {
        return textMatches.join('\n');
      }
    } catch {
      // Pass through
    }
    return null;
  }

  /**
   * HTTP POST with bounded exponential backoff retry for transient network errors & rate limits
   */
  private async fetchWithRetry<T>(
    url: string,
    body: any,
    providerLabel: string,
    attempt = 1
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      this.logger.log(`[OCR:${providerLabel}] Dispatching request (attempt ${attempt}/${this.maxRetries})...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle transient errors (429 Rate Limit, 500, 502, 503, 504)
      if (
        (response.status === 429 || (response.status >= 500 && response.status <= 504)) &&
        attempt < this.maxRetries
      ) {
        const backoffMs = Math.pow(2, attempt) * 500 + Math.random() * 200;
        this.logger.warn(
          `[OCR:${providerLabel}] Transient error HTTP ${response.status}. Retrying in ${Math.round(backoffMs)}ms...`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.fetchWithRetry<T>(url, body, providerLabel, attempt + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let parsedMessage = errorText.substring(0, 300);
        try {
          const jsonErr = JSON.parse(errorText);
          parsedMessage = jsonErr.error?.message || jsonErr.message || parsedMessage;
        } catch {
          // Keep text
        }
        const sanitized = parsedMessage
          .replace(/key=[A-Za-z0-9_\-\.]+/gi, 'key=[REDACTED]')
          .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
        throw new BadRequestException(
          `[OCR:${providerLabel}_ERROR] HTTP ${response.status}: ${sanitized}`
        );
      }

      return (await response.json()) as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        if (attempt < this.maxRetries) {
          this.logger.warn(`[OCR:${providerLabel}] Request timed out. Retrying attempt ${attempt + 1}...`);
          return this.fetchWithRetry<T>(url, body, providerLabel, attempt + 1);
        }
        throw new BadRequestException(
          `[OCR:${providerLabel}_TIMEOUT] Vision API timed out after ${this.maxRetries} attempts (${this.timeoutMs}ms)`
        );
      }
      throw error;
    }
  }

  /**
   * Process image or PDF using Google Cloud Vision REST API
   */
  private async processWithCloudVision(
    fileBuffer: Buffer,
    mimeType: string,
    apiKey: string
  ): Promise<OcrExtractionResult> {
    const base64Content = fileBuffer.toString('base64');

    if (mimeType === 'application/pdf') {
      // Use files:annotate endpoint for PDF files
      const endpoint = `https://vision.googleapis.com/v1/files:annotate?key=${apiKey}`;
      const payload = {
        requests: [
          {
            inputConfig: {
              content: base64Content,
              mimeType: 'application/pdf',
            },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            pages: [1, 2, 3, 4, 5],
          },
        ],
      };

      const res = await this.fetchWithRetry<GoogleVisionFileAnnotationResponse>(
        endpoint,
        payload,
        'GOOGLE_CLOUD_VISION'
      );
      const pageResponses = res.responses?.[0]?.responses || [];
      const allText = pageResponses
        .map((p) => p.fullTextAnnotation?.text || '')
        .filter(Boolean)
        .join('\n');

      const items = this.parseTextToItems(allText, 0.90);
      return {
        items,
        rawOcrText: allText,
        providerName: 'GOOGLE_CLOUD_VISION',
        isSimulated: false,
      };
    }

    // Image endpoint
    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const payload = {
      requests: [
        {
          image: { content: base64Content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };

    const res = await this.fetchWithRetry<GoogleVisionImageAnnotationResponse>(
      endpoint,
      payload,
      'GOOGLE_CLOUD_VISION'
    );
    const annotation = res.responses?.[0]?.fullTextAnnotation;

    if (!annotation || !annotation.text) {
      return {
        items: [],
        rawOcrText: '',
        providerName: 'GOOGLE_CLOUD_VISION',
        isSimulated: false,
      };
    }

    const overallConfidence = annotation.pages?.[0]?.confidence || 0.88;
    const items = this.parseTextToItems(annotation.text, overallConfidence);

    return {
      items,
      rawOcrText: annotation.text,
      providerName: 'GOOGLE_CLOUD_VISION',
      isSimulated: false,
    };
  }

  /**
   * Process document using Google Gemini Vision API
   */
  private async processWithGeminiVision(
    fileBuffer: Buffer,
    mimeType: string,
    apiKey: string
  ): Promise<OcrExtractionResult> {
    const base64Data = fileBuffer.toString('base64');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptText = `
You are an expert OCR vision scanner for a Sri Lankan stationery store (DSL Stationery).
Analyze this uploaded stationery shopping list image or document.
Extract all handwritten and printed items accurately.
For each item:
- rawText: The exact text line as visible in the image.
- cleanDescription: The clean stationery product name without quantities or bullets.
- quantity: Integer quantity required (default 1).
- unit: Unit if present ('nos', 'pcs', 'box', 'pack', 'reams', 'bottles', etc.).
- extractionConfidence: Float between 0.0 and 1.0 representing how clearly the handwriting/text is visible. If handwriting is messy or ambiguous, give lower confidence (e.g. 0.55-0.70) and preserve the raw text as is so the customer can review it.

Respond STRICTLY in JSON format matching this schema:
{
  "items": [
    {
      "rawText": "Atlas CR Book 120 Pages - 5 nos",
      "cleanDescription": "Atlas CR Book 120 Pages",
      "quantity": 5,
      "unit": "nos",
      "extractionConfidence": 0.95
    }
  ],
  "rawText": "Full raw text extracted from document"
}
`;

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const res = await this.fetchWithRetry<GeminiGenerateResponse>(
      endpoint,
      payload,
      'GEMINI_VISION'
    );
    const jsonText = res.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      throw new BadRequestException('[OCR:GEMINI_ERROR] Model returned empty content');
    }

    try {
      const parsed = JSON.parse(jsonText);
      const items: ExtractedLineItem[] = (parsed.items || []).map((it: any) => ({
        rawText: it.rawText || it.cleanDescription || 'Unlabeled item',
        cleanDescription: it.cleanDescription || it.rawText || 'Stationery Item',
        quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
        unit: it.unit || 'nos',
        extractionConfidence: Math.max(0.1, Math.min(1.0, parseFloat(it.extractionConfidence) || 0.85)),
      }));

      return {
        items,
        rawOcrText: parsed.rawText || items.map((i) => i.rawText).join('\n'),
        providerName: 'GEMINI_VISION',
        isSimulated: false,
      };
    } catch {
      const items = this.parseTextToItems(jsonText, 0.85);
      return {
        items,
        rawOcrText: jsonText,
        providerName: 'GEMINI_VISION',
        isSimulated: false,
      };
    }
  }

  /**
   * Main OCR extraction method
   */
  async extractItems(
    fileBuffer: Buffer,
    mimeType: string,
    options?: { customerNotes?: string }
  ): Promise<OcrExtractionResult> {
    // 1. Digital PDF Fast-Path
    if (mimeType === 'application/pdf') {
      const directText = this.extractTextFromPdfBuffer(fileBuffer);
      if (directText && directText.trim().length > 15) {
        this.logger.log('[OCR:DIGITAL_PDF_PARSER] Digital PDF text streams detected. Extracted text directly.');
        const items = this.parseTextToItems(directText, 0.98);
        if (items.length > 0) {
          return {
            items,
            rawOcrText: directText,
            providerName: 'DIGITAL_PDF_PARSER',
            isSimulated: false,
          };
        }
      }
    }

    // 2. Resolve provider configuration
    const resolved = this.resolveEffectiveProvider();

    if (resolved.provider === 'simulated') {
      this.logger.log(
        `[OCR:SIMULATED_DEV] Running simulation fallback in ${this.nodeEnv} environment (OCR_PROVIDER=${this.rawProviderMode}).`
      );
      const fallback = this.simulatedFallback || new SimulatedOcrProvider();
      const res = await fallback.extractItems(fileBuffer, mimeType, options);
      return {
        ...res,
        providerName: 'SIMULATED_DEV',
        isSimulated: true,
      };
    }

    // 3. Dispatch to explicit real provider
    // When a real provider is chosen, failure throws an error (NO SILENT FALLBACK)
    if (resolved.provider === 'google_vision') {
      this.logger.log('[OCR:GOOGLE_CLOUD_VISION] Executing real Google Cloud Vision OCR');
      return await this.processWithCloudVision(fileBuffer, mimeType, resolved.key!);
    } else {
      this.logger.log('[OCR:GEMINI_VISION] Executing real Google Gemini Vision OCR');
      return await this.processWithGeminiVision(fileBuffer, mimeType, resolved.key!);
    }
  }
}
