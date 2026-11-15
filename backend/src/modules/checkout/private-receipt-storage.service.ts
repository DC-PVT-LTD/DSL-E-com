import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface StagedReceiptMetadata {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHashSha256: string;
  userId?: string | null;
  sessionId?: string | null;
  exp: number;
}

export interface StagedReceiptResult {
  receiptToken: string;
  storageKey: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  fileHashSha256: string;
}

const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

@Injectable()
export class PrivateReceiptStorageService {
  private readonly logger = new Logger(PrivateReceiptStorageService.name);
  private readonly receiptsDirectory: string;
  private readonly signingSecret: string;

  constructor() {
    this.receiptsDirectory = path.resolve(
      process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'),
      'private',
      'receipts'
    );
    this.signingSecret =
      process.env.JWT_SECRET || 'dsl_stationery_private_receipt_signing_key_2026';

    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.receiptsDirectory)) {
      fs.mkdirSync(this.receiptsDirectory, { recursive: true });
      this.logger.log(`Initialized private receipt storage at: ${this.receiptsDirectory}`);
    }
  }

  /**
   * Verifies magic bytes of the file buffer to prevent disguise attacks.
   */
  verifyMagicBytes(buffer: Buffer, declaredMime: string): boolean {
    if (!buffer || buffer.length < 4) {
      return false;
    }

    const mime = declaredMime.toLowerCase();

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

  /**
   * Validates and saves an uploaded receipt file into private storage, returning a staging token.
   * Securely binds to the uploading user or session identifier.
   */
  async stageReceipt(
    file: Express.Multer.File,
    owner?: { userId?: string | null; sessionId?: string | null }
  ): Promise<StagedReceiptResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided for upload');
    }

    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of 10MB (received ${(file.size / (1024 * 1024)).toFixed(2)}MB)`
      );
    }

    const declaredMime = file.mimetype.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(declaredMime)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not permitted. Only JPEG, PNG, WebP, and PDF files are allowed.`
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `File extension "${ext}" is not permitted. Only .jpg, .jpeg, .png, .webp, and .pdf are allowed.`
      );
    }

    if (!this.verifyMagicBytes(file.buffer, declaredMime)) {
      throw new BadRequestException(
        `File content does not match the declared MIME type "${file.mimetype}". Invalid or disguised file.`
      );
    }

    // Compute cryptographic SHA-256 hash of file content
    const fileHashSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Generate non-enumerable, collision-safe storage key
    const uniqueId = crypto.randomUUID();
    const safeStorageKey = `${Date.now()}_${uniqueId}${ext}`;
    const destinationPath = path.join(this.receiptsDirectory, safeStorageKey);

    // Save to private storage
    this.ensureDirectoryExists();
    fs.writeFileSync(destinationPath, file.buffer);

    // Create signed staging token with 2-hour TTL and ownership binding
    const exp = Date.now() + 2 * 60 * 60 * 1000;
    const metadata: StagedReceiptMetadata = {
      storageKey: safeStorageKey,
      originalFilename: file.originalname,
      mimeType: declaredMime,
      fileSizeBytes: file.size,
      fileHashSha256,
      userId: owner?.userId || null,
      sessionId: owner?.sessionId || null,
      exp,
    };

    const tokenPayload = Buffer.from(JSON.stringify(metadata)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(tokenPayload)
      .digest('base64url');
    const receiptToken = `${tokenPayload}.${signature}`;

    return {
      receiptToken,
      storageKey: safeStorageKey,
      originalFilename: file.originalname,
      fileSizeBytes: file.size,
      mimeType: declaredMime,
      fileHashSha256,
    };
  }

  /**
   * Verifies a staging token, confirms owner matches (preventing cross-customer reuse),
   * and confirms the file is present in private storage.
   */
  verifyStagingToken(
    receiptToken: string,
    owner?: { userId?: string | null; sessionId?: string | null }
  ): StagedReceiptMetadata {
    if (!receiptToken || typeof receiptToken !== 'string') {
      throw new BadRequestException('Receipt token is required');
    }

    const parts = receiptToken.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Malformed receipt token');
    }

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid receipt token signature');
    }

    let metadata: StagedReceiptMetadata;
    try {
      metadata = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Corrupted receipt token payload');
    }

    if (Date.now() > metadata.exp) {
      throw new BadRequestException('Receipt upload session has expired. Please re-upload your payment receipt.');
    }

    // Customer cross-access prevention: verify owner binding if established
    if (owner && (owner.userId || owner.sessionId)) {
      if (metadata.userId && owner.userId && metadata.userId !== owner.userId) {
        throw new BadRequestException('Access denied: this receipt was uploaded by a different user session.');
      }
      if (
        !owner.userId &&
        metadata.sessionId &&
        owner.sessionId &&
        metadata.sessionId !== owner.sessionId
      ) {
        throw new BadRequestException('Access denied: this receipt was uploaded by a different guest session.');
      }
    }

    // Verify file still exists on disk
    const filePath = this.getSecureFilePath(metadata.storageKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Staged receipt file not found on server. Please re-upload.');
    }

    return metadata;
  }

  /**
   * Resolves a storage key to an absolute filesystem path with strict path-traversal prevention.
   */
  getSecureFilePath(storageKey: string): string {
    if (
      !storageKey ||
      typeof storageKey !== 'string' ||
      storageKey.includes('..') ||
      storageKey.includes('/') ||
      storageKey.includes('\\')
    ) {
      throw new BadRequestException('Invalid receipt storage key');
    }

    const resolved = path.resolve(this.receiptsDirectory, storageKey);
    if (!resolved.startsWith(this.receiptsDirectory + path.sep)) {
      throw new BadRequestException('Security violation: path traversal detected');
    }

    return resolved;
  }

  /**
   * Safely cleans up orphaned staged receipts that are older than maxAgeMs and
   * are guaranteed NOT to be associated with any existing order or BankDepositSubmission in the database.
   */
  async cleanupOrphanedStagedReceipts(
    activeStorageKeysInDb: Set<string>,
    maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<{ examined: number; deleted: number }> {
    this.ensureDirectoryExists();
    const files = fs.readdirSync(this.receiptsDirectory);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      // Never delete if file is associated with any confirmed BankDepositSubmission in DB
      if (activeStorageKeysInDb.has(file)) {
        continue;
      }

      try {
        const filePath = path.join(this.receiptsDirectory, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
          this.logger.log(`Safely purged orphaned unreferenced staged receipt: ${file}`);
        }
      } catch (err) {
        this.logger.warn(`Could not examine or purge orphaned file ${file}:`, err);
      }
    }

    return { examined: files.length, deleted: deletedCount };
  }
}

