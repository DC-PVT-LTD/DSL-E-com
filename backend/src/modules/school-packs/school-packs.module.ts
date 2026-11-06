import { Module } from '@nestjs/common';
import { SchoolPacksService } from './school-packs.service';
import { SchoolPacksController } from './school-packs.controller';
import { AdminSchoolPacksController } from './admin-school-packs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SchoolPacksController, AdminSchoolPacksController],
  providers: [SchoolPacksService],
  exports: [SchoolPacksService],
})
export class SchoolPacksModule {}

