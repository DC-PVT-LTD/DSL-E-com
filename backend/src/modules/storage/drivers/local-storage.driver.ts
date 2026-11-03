import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageDriver, StoredFile } from '../storage.interface';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.resolve(process.cwd(), 'public', 'uploads');
  }

  /**
   * Ensures the target directory exists and prevents directory traversal.
   */
  private resolveSafeFolderPath(folder: string): string {
    if (!folder || folder.includes('..') || path.isAbsolute(folder)) {
      throw new BadRequestException('Invalid storage path or directory traversal detected');
    }

    const sanitizedFolder = path.normalize(folder);
    const targetDir = path.resolve(this.baseUploadDir, sanitizedFolder);

    // Enforce path containment
    if (!targetDir.startsWith(this.baseUploadDir)) {
      throw new BadRequestException('Invalid storage path or directory traversal detected');
    }

    return targetDir;
  }

  /**
   * Sanitizes extension from original filename.
   */
  private getSafeExtension(originalName: string, mimeType: string): string {
    const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'pdf', 'svg'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }

    // Fallback from MIME
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/svg+xml':
        return 'svg';
      case 'application/pdf':
        return 'pdf';
      default:
        return 'bin';
    }
  }

  async upload(file: Express.Multer.File, folder = 'general'): Promise<StoredFile> {
    const safeTargetDir = this.resolveSafeFolderPath(folder);
    await fs.mkdir(safeTargetDir, { recursive: true });

    const ext = this.getSafeExtension(file.originalname, file.mimetype);
    const safeFileName = `${crypto.randomUUID()}.${ext}`;
    const destinationPath = path.join(safeTargetDir, safeFileName);

    await fs.writeFile(destinationPath, file.buffer);

    const relativePath = path
      .relative(this.baseUploadDir, destinationPath)
      .replace(/\\/g, '/');

    const publicUrl = `/uploads/${relativePath}`;

    this.logger.log(`Stored file locally: ${publicUrl} (${file.size} bytes)`);

    return {
      url: publicUrl,
      path: relativePath,
      filename: safeFileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  async delete(relativePath: string): Promise<void> {
    const safePath = path.resolve(this.baseUploadDir, path.normalize(relativePath));
    if (!safePath.startsWith(this.baseUploadDir)) {
      throw new BadRequestException('Invalid deletion path');
    }

    try {
      await fs.unlink(safePath);
      this.logger.log(`Deleted local file: ${relativePath}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  getPublicUrl(relativePath: string): string {
    const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return `/uploads/${cleanPath}`;
  }
}
