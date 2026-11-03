import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './drivers/local-storage.driver';

@Module({
  imports: [ConfigModule],
  providers: [LocalStorageDriver, StorageService],
  exports: [StorageService],
})
export class StorageModule {}

