import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { AuthModule } from '../auth/auth.module';
import { UploadedDocumentsService } from './uploaded-documents.service';
import { PrivateStorageService } from './private-storage.service';
import { SimulatedOcrProvider } from './ocr/simulated-ocr.provider';
import { RealVisionOcrProvider } from './ocr/real-vision-ocr.provider';
import { OcrVisionService } from './ocr/ocr-vision.service';
import { CatalogueMatcherService } from './catalogue-matcher.service';
import { UploadedDocumentsController } from './uploaded-documents.controller';
import { AdminUploadedDocumentsController } from './admin-uploaded-documents.controller';

@Module({
  imports: [PrismaModule, CartModule, AuthModule],
  controllers: [UploadedDocumentsController, AdminUploadedDocumentsController],
  providers: [
    UploadedDocumentsService,
    PrivateStorageService,
    SimulatedOcrProvider,
    RealVisionOcrProvider,
    OcrVisionService,
    CatalogueMatcherService,
  ],
  exports: [UploadedDocumentsService],
})
export class UploadedDocumentsModule {}

