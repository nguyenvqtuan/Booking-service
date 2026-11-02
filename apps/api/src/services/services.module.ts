import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, Service } from '../database/entities/index.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Service, Appointment])],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
