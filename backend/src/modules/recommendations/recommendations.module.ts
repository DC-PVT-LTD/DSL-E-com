import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { AdminRecommendationsController } from './admin-recommendations.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RecommendationsController, AdminRecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}

