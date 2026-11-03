import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { StorageService } from '../storage/storage.service';

describe('UploadController', () => {
  let controller: UploadController;
  let mockStorageService: any;

  beforeEach(() => {
    mockStorageService = {
      upload: vi.fn(),
    };
    controller = new UploadController(mockStorageService as unknown as StorageService);
  });

  it('rejects invalid folder names', async () => {
    const file = {
      originalname: 'test.png',
      mimetype: 'image/png',
      size: 100,
    } as Express.Multer.File;

    await expect(controller.uploadFile(file, 'invalid-folder')).rejects.toThrow(
      BadRequestException
    );
  });

  it('delegates to storageService.upload with target folder and returns api response', async () => {
    const file = {
      originalname: 'book.png',
      mimetype: 'image/png',
      size: 1500,
    } as Express.Multer.File;

    const storedResult = {
      url: '/uploads/products/uuid.png',
      path: 'products/uuid.png',
      filename: 'uuid.png',
      originalName: 'book.png',
      mimeType: 'image/png',
      sizeBytes: 1500,
    };

    mockStorageService.upload.mockResolvedValue(storedResult);

    const res = await controller.uploadFile(file, 'products');

    expect(mockStorageService.upload).toHaveBeenCalledWith(file, 'products');
    expect(res.data).toEqual(storedResult);
    expect(res.message).toBe('File uploaded successfully');
  });
});

