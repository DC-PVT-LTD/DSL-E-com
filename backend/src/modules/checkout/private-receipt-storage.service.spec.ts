import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrivateReceiptStorageService } from './private-receipt-storage.service';

describe('PrivateReceiptStorageService', () => {
  let service: PrivateReceiptStorageService;
  const tempDir = path.resolve(process.cwd(), 'storage', 'test-private-receipts');

  beforeEach(() => {
    process.env.STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'test-private');
    service = new PrivateReceiptStorageService();
  });

  afterEach(() => {
    const receiptsDir = path.resolve(process.env.STORAGE_DIR!, 'private', 'receipts');
    if (fs.existsSync(receiptsDir)) {
      try {
        fs.rmSync(path.resolve(process.env.STORAGE_DIR!), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  describe('verifyMagicBytes', () => {
    it('correctly identifies valid JPEG file header (FF D8 FF)', () => {
      const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(service.verifyMagicBytes(validJpegBuffer, 'image/jpeg')).toBe(true);
      expect(service.verifyMagicBytes(validJpegBuffer, 'image/jpg')).toBe(true);
    });

    it('correctly identifies valid PNG file header (89 50 4E 47)', () => {
      const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(service.verifyMagicBytes(validPngBuffer, 'image/png')).toBe(true);
    });

    it('correctly identifies valid WebP file header (RIFF....WEBP)', () => {
      const validWebpBuffer = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.from([0x24, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP', 'ascii'),
      ]);
      expect(service.verifyMagicBytes(validWebpBuffer, 'image/webp')).toBe(true);
    });

    it('correctly identifies valid PDF file header (%PDF)', () => {
      const validPdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4', 'ascii'),
        Buffer.from([0x0a, 0x25, 0xe2, 0xe3]),
      ]);
      expect(service.verifyMagicBytes(validPdfBuffer, 'application/pdf')).toBe(true);
    });

    it('rejects disguised executable (MZ header) claiming to be an image or pdf', () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      expect(service.verifyMagicBytes(exeBuffer, 'image/jpeg')).toBe(false);
      expect(service.verifyMagicBytes(exeBuffer, 'image/png')).toBe(false);
      expect(service.verifyMagicBytes(exeBuffer, 'application/pdf')).toBe(false);
    });

    it('rejects plain text files claiming to be a PDF or image', () => {
      const textBuffer = Buffer.from('This is a plain text file pretending to be receipt.jpg');
      expect(service.verifyMagicBytes(textBuffer, 'image/jpeg')).toBe(false);
      expect(service.verifyMagicBytes(textBuffer, 'application/pdf')).toBe(false);
    });
  });

  describe('stageReceipt and verifyStagingToken', () => {
    it('successfully stages valid receipt and generates verifiable staging token', async () => {
      const samplePdf = Buffer.concat([
        Buffer.from('%PDF-1.5', 'ascii'),
        Buffer.from('\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
      ]);

      const mockFile: Express.Multer.File = {
        fieldname: 'receipt',
        originalname: 'deposit-slip-2026.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: samplePdf,
        size: samplePdf.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const staged = await service.stageReceipt(mockFile);
      expect(staged.receiptToken).toBeDefined();
      expect(staged.storageKey).toMatch(/\.pdf$/);
      expect(staged.originalFilename).toBe('deposit-slip-2026.pdf');
      expect(staged.mimeType).toBe('application/pdf');
      expect(staged.fileHashSha256).toBeDefined();

      // Verify token
      const verified = service.verifyStagingToken(staged.receiptToken);
      expect(verified.storageKey).toBe(staged.storageKey);
      expect(verified.originalFilename).toBe('deposit-slip-2026.pdf');
      expect(verified.mimeType).toBe('application/pdf');
    });

    it('enforces customer and session binding: prevents cross-customer token usage', async () => {
      const samplePdf = Buffer.concat([
        Buffer.from('%PDF-1.5', 'ascii'),
        Buffer.from('\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
      ]);

      const mockFile: Express.Multer.File = {
        fieldname: 'receipt',
        originalname: 'customerA-receipt.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: samplePdf,
        size: samplePdf.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      // Staged by User A
      const stagedA = await service.stageReceipt(mockFile, {
        userId: 'user-a-123',
        sessionId: 'session-a-123',
      });

      // Verification by User A succeeds
      expect(service.verifyStagingToken(stagedA.receiptToken, { userId: 'user-a-123' })).toBeDefined();

      // Verification by User B fails with cross-customer violation
      expect(() =>
        service.verifyStagingToken(stagedA.receiptToken, { userId: 'user-b-456' })
      ).toThrow(BadRequestException);

      // Guest session binding test
      const stagedGuest = await service.stageReceipt(mockFile, {
        userId: null,
        sessionId: 'guest-session-111',
      });

      // Same guest succeeds
      expect(
        service.verifyStagingToken(stagedGuest.receiptToken, {
          userId: null,
          sessionId: 'guest-session-111',
        })
      ).toBeDefined();

      // Different guest fails
      expect(() =>
        service.verifyStagingToken(stagedGuest.receiptToken, {
          userId: null,
          sessionId: 'guest-session-222',
        })
      ).toThrow(BadRequestException);
    });

    it('rejects file larger than 10MB', async () => {
      const largeFile: Express.Multer.File = {
        fieldname: 'receipt',
        originalname: 'huge.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1024),
        size: 10 * 1024 * 1024 + 1024,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      await expect(service.stageReceipt(largeFile)).rejects.toThrow(BadRequestException);
    });

    it('rejects forbidden file extensions', async () => {
      const forbiddenFile: Express.Multer.File = {
        fieldname: 'receipt',
        originalname: 'script.exe',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 sample'),
        size: 20,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      await expect(service.stageReceipt(forbiddenFile)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSecureFilePath', () => {
    it('resolves valid key within private directory', () => {
      const safeKey = '1731600000000_abc-123.pdf';
      const resolved = service.getSecureFilePath(safeKey);
      expect(resolved).toContain('storage');
      expect(resolved).toContain('private');
      expect(resolved).toContain('receipts');
      expect(resolved.endsWith(safeKey)).toBe(true);
    });

    it('strictly detects and blocks path traversal attempts with ../ or backslashes', () => {
      expect(() => service.getSecureFilePath('../../../etc/passwd')).toThrow(BadRequestException);
      expect(() => service.getSecureFilePath('..\\..\\Windows\\System32\\cmd.exe')).toThrow(BadRequestException);
      expect(() => service.getSecureFilePath('subfolder/receipt.pdf')).toThrow(BadRequestException);
    });
  });

  describe('cleanupOrphanedStagedReceipts', () => {
    it('safely cleans orphaned files older than threshold while preserving active database files', async () => {
      const receiptsDir = path.resolve(process.env.STORAGE_DIR!, 'private', 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }

      const activeKey = 'active_order_slip.pdf';
      const orphanedKeyOld = 'orphaned_old_slip.pdf';
      const orphanedKeyRecent = 'orphaned_recent_slip.pdf';

      fs.writeFileSync(path.join(receiptsDir, activeKey), 'dummy active');
      fs.writeFileSync(path.join(receiptsDir, orphanedKeyOld), 'dummy old');
      fs.writeFileSync(path.join(receiptsDir, orphanedKeyRecent), 'dummy recent');

      // Set old file modified time to 48 hours ago
      const oldTime = Date.now() - 48 * 60 * 60 * 1000;
      fs.utimesSync(path.join(receiptsDir, orphanedKeyOld), oldTime / 1000, oldTime / 1000);

      // Active files in database
      const activeKeysInDb = new Set<string>([activeKey]);

      // Run cleanup with 24-hour threshold
      const res = await service.cleanupOrphanedStagedReceipts(activeKeysInDb, 24 * 60 * 60 * 1000);

      expect(res.deleted).toBe(1);
      expect(fs.existsSync(path.join(receiptsDir, activeKey))).toBe(true);
      expect(fs.existsSync(path.join(receiptsDir, orphanedKeyRecent))).toBe(true);
      expect(fs.existsSync(path.join(receiptsDir, orphanedKeyOld))).toBe(false);
    });
  });
});

