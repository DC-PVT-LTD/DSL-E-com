import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver, StoredFile } from './storage.interface';
import { LocalStorageDriver } from './drivers/local-storage.driver';

@Injectable()
export class StorageService implements StorageDriver {
  private readonly logger = new Logger(StorageService.name);
  private readonly activeDriver: StorageDriver;

  constructor(
    @Inject(LocalStorageDriver) private readonly localDriver: LocalStorageDriver,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService
  ) {
    const driverType = this.configService?.get<string>('STORAGE_DRIVER', 'local') || 'local';

    if (driverType === 's3') {
      this.logger.warn(
        'S3 storage driver is configured in environment, but cloud credentials are not active. Falling back to local filesystem driver.'
      );
      this.activeDriver = this.localDriver;
    } else {
      this.activeDriver = this.localDriver;
      this.logger.log('Storage initialized with LocalStorageDriver (public/uploads)');
    }
  }

  async upload(file: Express.Multer.File, folder = 'general'): Promise<StoredFile> {
    return this.activeDriver.upload(file, folder);
  }

  async delete(filePath: string): Promise<void> {
    return this.activeDriver.delete(filePath);
  }

  getPublicUrl(filePath: string): string {
    return this.activeDriver.getPublicUrl(filePath);
  }
}
