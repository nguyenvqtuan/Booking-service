import { Body, Controller, Get, Put } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { type SalonSettingsDto, salonSettingsSchema } from '@booking/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Salon } from '../database/entities/index.js';
import { CurrentSalon } from '../tenancy/index.js';

@Controller('salon-settings')
export class SalonSettingsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async get(@CurrentSalon() salonId: string): Promise<SalonSettingsDto> {
    const salon = await this.dataSource.getRepository(Salon).findOneByOrFail({ id: salonId });
    return { onlineBookingOtp: salon.onlineBookingOtp };
  }

  @Put()
  async update(
    @CurrentSalon() salonId: string,
    @Body(new ZodValidationPipe(salonSettingsSchema)) body: SalonSettingsDto,
  ): Promise<SalonSettingsDto> {
    await this.dataSource
      .getRepository(Salon)
      .update({ id: salonId }, { onlineBookingOtp: body.onlineBookingOtp });
    return body;
  }
}
