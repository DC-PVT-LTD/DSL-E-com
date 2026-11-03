import { describe, it, expect, afterAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LocalStorageDriver } from './local-storage.driver';

describe('LocalStorageDriver', () => {
  const driver = new LocalStorageDriver();
  let uploadedFilePath: string | null = null;

  afterAll(async () => {
    if (uploadedFilePath) {
      await driver.delete(uploadedFilePath).catch(() => {});
    }
  });

  it('rejects path traversal in target folder', async () => {
    const file = {
      buffer: Buffer.from('test'),
      size: 4,
      mimetype: 'image/png',
      originalname: 'test.png',
    } as Express.Multer.File;

    await expect(driver.upload(file, '../../../../etc')).rejects.toThrow(BadRequestException);
    await expect(driver.upload(file, '..\\..\\etc')).rejects.toThrow(BadRequestException);
  });

  it('generates a safe UUID filename and resolves relative URL', async () => {
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      size: 8,
      mimetype: 'image/png',
      originalname: 'pencil.png',
    } as Express.Multer.File;

    const result = await driver.upload(file, 'test-products');
    uploadedFilePath = result.path;

    expect(result.url).toMatch(/^\/uploads\/test-products\/[a-f0-9-]+\.png$/);
    expect(result.path).toMatch(/^test-products[/\\][a-f0-9-]+\.png$/);
    expect(result.mimeType).toBe('image/png');
    expect(result.originalName).toBe('pencil.png');
  });

  it('getPublicUrl returns clean normalized URL with leading slash', () => {
    expect(driver.getPublicUrl('products/abc.png')).toBe('/uploads/products/abc.png');
    expect(driver.getPublicUrl('/products/abc.png')).toBe('/uploads/products/abc.png');
  });
});
