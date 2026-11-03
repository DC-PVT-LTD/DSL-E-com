import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowSvg?: boolean;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class FileValidationPipe implements PipeTransform<Express.Multer.File, Express.Multer.File> {
  private readonly maxSizeBytes: number;
  private readonly allowedMimeTypes: string[];

  constructor(options?: FileValidationOptions) {
    this.maxSizeBytes = options?.maxSizeBytes || DEFAULT_MAX_SIZE;
    this.allowedMimeTypes = options?.allowedMimeTypes || DEFAULT_ALLOWED_MIMES;
    if (options?.allowSvg && !this.allowedMimeTypes.includes('image/svg+xml')) {
      this.allowedMimeTypes.push('image/svg+xml');
    }
  }

  /**
   * Verifies that the file buffer magic bytes match the claimed MIME type.
   * Prevents malicious executables disguised with image extensions.
   */
  private verifyMagicBytes(file: Express.Multer.File): boolean {
    const buffer = file.buffer;
    if (!buffer || buffer.length < 4) {
      return false;
    }

    const mime = file.mimetype.toLowerCase();

    // JPEG: FF D8 FF
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (mime === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }

    // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
    if (mime === 'image/webp') {
      if (buffer.length < 12) return false;
      const isRiff =
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46;
      const isWebp =
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50;
      return isRiff && isWebp;
    }

    // SVG: Text XML starting with <svg or <?xml
    if (mime === 'image/svg+xml') {
      const textHeader = buffer.slice(0, 100).toString('utf-8').trim().toLowerCase();
      return textHeader.startsWith('<svg') || textHeader.startsWith('<?xml');
    }

    // PDF: %PDF- (25 50 44 46)
    if (mime === 'application/pdf') {
      return (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );
    }

    return false;
  }

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    if (file.size > this.maxSizeBytes) {
      const maxMb = (this.maxSizeBytes / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(`File size exceeds maximum allowed limit of ${maxMb}MB`);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not permitted. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }

    if (!this.verifyMagicBytes(file)) {
      throw new BadRequestException(
        `File content does not match the declared MIME type "${file.mimetype}". Corrupted or invalid file.`
      );
    }

    return file;
  }
}

