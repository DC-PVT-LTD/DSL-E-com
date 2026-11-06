import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PrivateStorageService } from './private-storage.service';
import * as fs from 'fs';
import * as path from 'path';

describe('PrivateStorageService', () => {
  let service: PrivateStorageService;
  const createdFiles: string[] = [];

  beforeEach(() => {
    service = new PrivateStorageService();
  });

  afterEach(async () => {
    for (const f of createdFiles) {
      await service.deleteFile(f).catch(() => {});
    }
  });

  it('validates JPEG magic bytes correctly', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const result = service.validateMagicBytes(jpegBuffer);
    expect(result.isValid).toBe(true);
    expect(result.detectedMime).toBe('image/jpeg');
  });

  it('validates PNG magic bytes correctly', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = service.validateMagicBytes(pngBuffer);
    expect(result.isValid).toBe(true);
    expect(result.detectedMime).toBe('image/png');
  });

  it('validates PDF magic bytes correctly', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 test content');
    const result = service.validateMagicBytes(pdfBuffer);
    expect(result.isValid).toBe(true);
    expect(result.detectedMime).toBe('application/pdf');
  });

  it('rejects spoofed files with invalid magic bytes', () => {
    const fakeBuffer = Buffer.from('NOT A REAL IMAGE');
    const result = service.validateMagicBytes(fakeBuffer);
    expect(result.isValid).toBe(false);
    expect(result.detectedMime).toBeNull();
  });

  it('rejects upload exceeding 10MB limit', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const mockFile: Express.Multer.File = {
      buffer: largeBuffer,
      originalname: 'huge.jpg',
      mimetype: 'image/jpeg',
      fieldname: 'file',
      encoding: '7bit',
      size: largeBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    await expect(service.saveDocumentFile(mockFile)).rejects.toThrow(BadRequestException);
  });

  it('saves authentic PNG file and verifies existence', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const mockFile: Express.Multer.File = {
      buffer: validPng,
      originalname: 'receipt.png',
      mimetype: 'image/png',
      fieldname: 'file',
      encoding: '7bit',
      size: validPng.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const saved = await service.saveDocumentFile(mockFile);
    createdFiles.push(saved.storagePath);

    expect(saved.storagePath).toBeDefined();
    expect(service.fileExists(saved.storagePath)).toBe(true);
    expect(saved.mimeType).toBe('image/png');
  });
});

