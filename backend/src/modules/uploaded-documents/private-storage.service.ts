import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SavedPrivateFile {
  storagePath: string;
  originalFileName: string;
  savedFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  pageCount: number;
}

@Injectable()
export class PrivateStorageService {
  private readonly logger = new Logger(PrivateStorageService.name);
  private readonly baseUploadDir: string;
  private readonly maxFileSizeBytes = 10 * 1024 * 1024; // 10MB limit

  constructor() {
    this.baseUploadDir = path.resolve(process.cwd(), 'storage', 'private_uploads', 'documents');
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  /**
   * Validates magic bytes to prevent spoofed MIME types.
   */
  validateMagicBytes(buffer: Buffer): { isValid: boolean; detectedMime: string | null } {
    if (!buffer || buffer.length < 4) {
      return { isValid: false, detectedMime: null };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { isValid: true, detectedMime: 'image/jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { isValid: true, detectedMime: 'image/png' };
    }

    // PDF: %PDF- (25 50 44 46 2D)
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return { isValid: true, detectedMime: 'application/pdf' };
    }

    return { isValid: false, detectedMime: null };
  }

  /**
   * Estimates PDF page count from buffer
   */
  private estimatePdfPageCount(buffer: Buffer): number {
    try {
      const content = buffer.toString('binary');
      // Match /Type /Page (excluding /Pages)
      const matches = content.match(/\/Type\s*\/Page\b/g);
      return matches && matches.length > 0 ? matches.length : 1;
    } catch {
      return 1;
    }
  }

  /**
   * Validate and save an uploaded file into the private storage directory.
   */
  async saveDocumentFile(file: Express.Multer.File): Promise<SavedPrivateFile> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded or file buffer is empty');
    }

    if (file.buffer.length > this.maxFileSizeBytes) {
      throw new BadRequestException('File exceeds the 10MB size limit');
    }

    const { isValid, detectedMime } = this.validateMagicBytes(file.buffer);
    if (!isValid || !detectedMime) {
      throw new BadRequestException(
        'Invalid file type. Only authentic JPG, PNG, and PDF files are permitted.'
      );
    }

    // Verify file extension matches detected mime
    const ext = path.extname(file.originalname).toLowerCase();
    const validExtensionsByMime: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    };

    const allowedExts = validExtensionsByMime[detectedMime] || [];
    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(
        `File extension '${ext}' does not match detected MIME type '${detectedMime}'`
      );
    }

    const uniqueId = crypto.randomUUID();
    const safeFileName = `${uniqueId}${ext}`;
    const targetFilePath = path.join(this.baseUploadDir, safeFileName);

    await fs.promises.writeFile(targetFilePath, file.buffer);

    let pageCount = 1;
    if (detectedMime === 'application/pdf') {
      pageCount = this.estimatePdfPageCount(file.buffer);
    }

    this.logger.log(`Securely saved document ${safeFileName} (${file.buffer.length} bytes) to private storage`);

    return {
      storagePath: safeFileName,
      originalFileName: file.originalname,
      savedFileName: safeFileName,
      fileSizeBytes: file.buffer.length,
      mimeType: detectedMime,
      pageCount,
    };
  }

  /**
   * Get absolute path for a stored file, preventing path traversal
   */
  getAbsolutePath(storagePath: string): string {
    const normalized = path.basename(storagePath);
    return path.join(this.baseUploadDir, normalized);
  }

  /**
   * Check if file exists in private storage
   */
  fileExists(storagePath: string): boolean {
    const fullPath = this.getAbsolutePath(storagePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Get readable stream for downloading/viewing private file
   */
  getFileStream(storagePath: string): fs.ReadStream {
    const fullPath = this.getAbsolutePath(storagePath);
    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('File not found in storage');
    }
    return fs.createReadStream(fullPath);
  }

  /**
   * Get buffer for re-processing or retry
   */
  async getDocumentBuffer(storagePath: string): Promise<Buffer> {
    const fullPath = this.getAbsolutePath(storagePath);
    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('File not found in storage');
    }
    return fs.promises.readFile(fullPath);
  }

  /**
   * Delete file from private storage
   */
  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = this.getAbsolutePath(storagePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      this.logger.log(`Deleted private file ${storagePath}`);
    }
  }
}

