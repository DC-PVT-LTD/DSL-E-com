import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';

describe('FileValidationPipe', () => {
  const pipe = new FileValidationPipe({ maxSizeBytes: 1024 * 1024 }); // 1 MB limit for test

  it('accepts a valid JPEG image with correct magic bytes', () => {
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const file = {
      buffer: validJpegBuffer,
      size: validJpegBuffer.length,
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    } as Express.Multer.File;

    expect(pipe.transform(file)).toBe(file);
  });

  it('accepts a valid PNG image with correct magic bytes', () => {
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const file = {
      buffer: validPngBuffer,
      size: validPngBuffer.length,
      mimetype: 'image/png',
      originalname: 'test.png',
    } as Express.Multer.File;

    expect(pipe.transform(file)).toBe(file);
  });

  it('accepts a valid WebP image with RIFF and WEBP magic bytes', () => {
    // 0-3: RIFF (52 49 46 46), 4-7: length, 8-11: WEBP (57 45 42 50)
    const validWebpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const file = {
      buffer: validWebpBuffer,
      size: validWebpBuffer.length,
      mimetype: 'image/webp',
      originalname: 'test.webp',
    } as Express.Multer.File;

    expect(pipe.transform(file)).toBe(file);
  });

  it('rejects files exceeding size limit', () => {
    const largeBuffer = Buffer.alloc(2 * 1024 * 1024); // 2 MB
    const file = {
      buffer: largeBuffer,
      size: largeBuffer.length,
      mimetype: 'image/jpeg',
      originalname: 'huge.jpg',
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow(/exceeds maximum allowed limit/);
  });

  it('rejects disallowed file types', () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
    const file = {
      buffer: exeBuffer,
      size: exeBuffer.length,
      mimetype: 'application/x-msdownload',
      originalname: 'malware.exe',
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow(/not permitted/);
  });

  it('rejects disguised files with mismatched magic bytes', () => {
    // Declared as image/jpeg, but content is fake or text
    const textBuffer = Buffer.from('This is not a real JPEG image file');
    const file = {
      buffer: textBuffer,
      size: textBuffer.length,
      mimetype: 'image/jpeg',
      originalname: 'fake.jpg',
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow(/does not match the declared MIME type/);
  });
});

