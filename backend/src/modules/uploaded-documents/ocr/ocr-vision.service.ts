import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OcrVisionProvider, OcrExtractionResult } from './ocr-provider.interface';
import { SimulatedOcrProvider } from './simulated-ocr.provider';
import { RealVisionOcrProvider } from './real-vision-ocr.provider';

@Injectable()
export class OcrVisionService {
  private readonly logger = new Logger(OcrVisionService.name);
  private activeProvider: OcrVisionProvider;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly simulatedProvider?: SimulatedOcrProvider,
    @Optional() private readonly realVisionProvider?: RealVisionOcrProvider
  ) {
    const configuredMode = this.configService?.get<string>('OCR_PROVIDER') || process.env.OCR_PROVIDER || 'auto';
    const fallbackSim = this.simulatedProvider || new SimulatedOcrProvider();
    const realProvider = this.realVisionProvider || new RealVisionOcrProvider(this.configService, fallbackSim);

    if (configuredMode === 'simulated') {
      this.logger.log('OCR provider initialized in SIMULATED mode as configured by OCR_PROVIDER=simulated');
      this.activeProvider = fallbackSim;
    } else {
      this.logger.log(`OCR provider initialized with REAL_VISION_OCR provider (mode: ${configuredMode})`);
      this.activeProvider = realProvider;
    }
  }

  /**
   * Set custom provider for testing or cloud adapter swap
   */
  setProvider(provider: OcrVisionProvider) {
    this.activeProvider = provider;
  }

  getActiveProviderName(): string {
    return this.activeProvider.providerName;
  }

  /**
   * Extract items from document buffer
   */
  async processDocument(
    fileBuffer: Buffer,
    mimeType: string,
    options?: { customerNotes?: string }
  ): Promise<OcrExtractionResult> {
    this.logger.log(`Dispatching OCR extraction to active provider '${this.activeProvider.providerName}'`);
    try {
      return await this.activeProvider.extractItems(fileBuffer, mimeType, options);
    } catch (error) {
      this.logger.error(`OCR extraction failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
