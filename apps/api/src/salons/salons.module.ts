import { Module } from '@nestjs/common';
import { SalonDeletionService } from './salon-deletion.service.js';
import { SalonSettingsController } from './salon-settings.controller.js';
import { SalonsController } from './salons.controller.js';

@Module({
  controllers: [SalonSettingsController, SalonsController],
  providers: [SalonDeletionService],
  exports: [SalonDeletionService],
})
export class SalonsModule {}
