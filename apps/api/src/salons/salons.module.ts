import { Module } from '@nestjs/common';
import { SalonDeletionService } from './salon-deletion.service.js';
import { SalonSettingsController } from './salon-settings.controller.js';

@Module({
  controllers: [SalonSettingsController],
  providers: [SalonDeletionService],
  exports: [SalonDeletionService],
})
export class SalonsModule {}
