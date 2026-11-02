import { Module } from '@nestjs/common';
import { SalonDeletionService } from './salon-deletion.service.js';

@Module({ providers: [SalonDeletionService], exports: [SalonDeletionService] })
export class SalonsModule {}
