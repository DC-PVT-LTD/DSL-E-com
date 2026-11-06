import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealVisionOcrProvider } from './real-vision-ocr.provider';
import { ConfigService } from '@nestjs/config';
import { SimulatedOcrProvider } from './simulated-ocr.provider';
import { BadRequestException } from '@nestjs/common';

describe('RealVisionOcrProvider', () => {
  let provider: RealVisionOcrProvider;
  let mockConfigService: any;
  let mockSimulatedProvider: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'OCR_API_KEY') return 'test-vision-api-key-123';
        if (key === 'OCR_PROVIDER') return 'auto';
        if (key === 'OCR_MAX_RETRIES') return 3;
        if (key === 'OCR_TIMEOUT_MS') return 2000;
        if (key === 'NODE_ENV') return 'development';
        return null;
      }),
    };

    mockSimulatedProvider = {
      extractItems: vi.fn().mockResolvedValue({
        items: [
          {
            rawText: 'Atlas CR Book 120 Pages - 5 nos',
            cleanDescription: 'Atlas CR Book 120 Pages',
            quantity: 5,
            unit: 'nos',
            extractionConfidence: 0.95,
          },
        ],
        rawOcrText: 'Atlas CR Book 120 Pages - 5 nos',
        providerName: 'SIMULATED_VISION_OCR',
        isSimulated: true,
      }),
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('strictly throws BadRequestException when google_vision is explicitly configured but key is missing', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OCR_PROVIDER') return 'google_vision';
      return null;
    });

    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    expect(() => provider.resolveEffectiveProvider()).toThrow(BadRequestException);
  });

  it('strictly throws BadRequestException when gemini_vision is explicitly configured but key is missing', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OCR_PROVIDER') return 'gemini_vision';
      return null;
    });

    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    expect(() => provider.resolveEffectiveProvider()).toThrow(BadRequestException);
  });

  it('selects simulated mode when OCR_PROVIDER=simulated is configured', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OCR_PROVIDER') return 'simulated';
      return null;
    });

    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    const dummyBuffer = Buffer.from('test-image-content');
    const result = await provider.extractItems(dummyBuffer, 'image/jpeg');

    expect(mockSimulatedProvider.extractItems).toHaveBeenCalledTimes(1);
    expect(result.isSimulated).toBe(true);
    expect(result.providerName).toBe('SIMULATED_DEV');
  });

  it('parses digital text streams directly from text-based PDFs without external API calls', async () => {
    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    // Synthetic PDF buffer with BT ... (text) Tj ... ET streams
    const pdfText =
      '%PDF-1.4\n' +
      'BT\n' +
      '(1. Atlas CR Book 120 Pages - 6 pcs) Tj\n' +
      '(2. DOMS Coloured Fragrance Eraser 20Pcs - 1 box) Tj\n' +
      '(3. Nataraj Ruby Pencils - 2 packs) Tj\n' +
      'ET\n' +
      '%%EOF';

    const pdfBuffer = Buffer.from(pdfText);
    const result = await provider.extractItems(pdfBuffer, 'application/pdf');

    expect(result.providerName).toBe('DIGITAL_PDF_PARSER');
    expect(result.isSimulated).toBe(false);
    expect(result.items.length).toBe(3);
    expect(result.items[0].cleanDescription).toBe('Atlas CR Book 120 Pages');
    expect(result.items[0].quantity).toBe(6);
    expect(result.items[0].unit).toBe('pcs');
  });

  it('successfully extracts structured items and preserves unclear handwriting via Gemini Vision', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OCR_PROVIDER') return 'gemini_vision';
      if (key === 'GEMINI_API_KEY') return 'test-gemini-key-999';
      return null;
    });

    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  items: [
                    {
                      rawText: 'Atlas CR Book 120 Pages - 4 Nos',
                      cleanDescription: 'Atlas CR Book 120 Pages',
                      quantity: 4,
                      unit: 'nos',
                      extractionConfidence: 0.96,
                    },
                    {
                      rawText: 'Unclear smudged pencil text (looks like Maped ruler)',
                      cleanDescription: 'Unclear smudged pencil text',
                      quantity: 1,
                      unit: 'nos',
                      extractionConfidence: 0.55,
                    },
                  ],
                  rawText: 'Atlas CR Book 120 Pages - 4 Nos\nUnclear smudged pencil text',
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as any);

    const dummyImage = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = await provider.extractItems(dummyImage, 'image/jpeg');

    expect(result.providerName).toBe('GEMINI_VISION');
    expect(result.isSimulated).toBe(false);
    expect(result.items.length).toBe(2);

    // High confidence item
    expect(result.items[0].cleanDescription).toBe('Atlas CR Book 120 Pages');
    expect(result.items[0].quantity).toBe(4);
    expect(result.items[0].extractionConfidence).toBe(0.96);

    // Low confidence item preserved for customer review (never fabricated)
    expect(result.items[1].cleanDescription).toBe('Unclear smudged pencil text');
    expect(result.items[1].extractionConfidence).toBe(0.55);
  });

  it('successfully extracts items via Google Cloud Vision API', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OCR_PROVIDER') return 'google_vision';
      if (key === 'GOOGLE_VISION_API_KEY') return 'test-google-key-888';
      return null;
    });

    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    const mockVisionResponse = {
      responses: [
        {
          fullTextAnnotation: {
            text: '1. DOMS Coloured Fragrance Eraser 20Pcs - 2 boxes\n2. Speed Fabric Paint Deep Green 108 - 1 bottle',
            pages: [{ confidence: 0.94 }],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockVisionResponse,
    } as any);

    const dummyImage = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = await provider.extractItems(dummyImage, 'image/jpeg');

    expect(result.providerName).toBe('GOOGLE_CLOUD_VISION');
    expect(result.isSimulated).toBe(false);
    expect(result.items.length).toBe(2);
    expect(result.items[0].cleanDescription).toBe('DOMS Coloured Fragrance Eraser 20Pcs');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[1].cleanDescription).toBe('Speed Fabric Paint Deep Green 108');
    expect(result.items[1].quantity).toBe(1);
  });

  it('retries on recoverable transient HTTP 429 rate limits and succeeds on retry', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OCR_PROVIDER') return 'gemini_vision';
      if (key === 'GEMINI_API_KEY') return 'test-key';
      if (key === 'OCR_MAX_RETRIES') return 3;
      return null;
    });

    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded, try again later',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      items: [
                        {
                          rawText: 'Speed Fabric Paint Deep Green 108 - 2 bottles',
                          cleanDescription: 'Speed Fabric Paint Deep Green 108',
                          quantity: 2,
                          unit: 'bottles',
                          extractionConfidence: 0.92,
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    });

    const dummyImage = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const result = await provider.extractItems(dummyImage, 'image/png');

    expect(callCount).toBe(2);
    expect(result.items.length).toBe(1);
    expect(result.items[0].cleanDescription).toBe('Speed Fabric Paint Deep Green 108');
  });

  it('NO SILENT FALLBACK: when real provider fails, throws clear error and does not fabricate simulated items', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'OCR_PROVIDER') return 'gemini_vision';
      if (key === 'GEMINI_API_KEY') return 'test-key';
      return null;
    });

    provider = new RealVisionOcrProvider(
      mockConfigService as ConfigService,
      mockSimulatedProvider as SimulatedOcrProvider
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }),
    } as any);

    const dummyImage = Buffer.from([0xff, 0xd8, 0xff]);
    await expect(provider.extractItems(dummyImage, 'image/jpeg')).rejects.toThrow(BadRequestException);

    // Verify simulated provider was NEVER called to fabricate items
    expect(mockSimulatedProvider.extractItems).not.toHaveBeenCalled();
  });
});
