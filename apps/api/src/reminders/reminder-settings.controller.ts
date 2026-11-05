import { Body, Controller, Get, Put } from '@nestjs/common';
import { type ReminderSettingsDto, reminderSettingsSchema } from '@booking/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentSalon } from '../tenancy/index.js';
import { ReminderSettingsService } from './reminder-settings.service.js';

@Controller('reminder-settings')
export class ReminderSettingsController {
  constructor(private readonly settings: ReminderSettingsService) {}

  @Get()
  get(@CurrentSalon() salonId: string): Promise<ReminderSettingsDto> {
    return this.settings.get(salonId);
  }

  @Put()
  update(
    @CurrentSalon() salonId: string,
    @Body(new ZodValidationPipe(reminderSettingsSchema)) body: ReminderSettingsDto,
  ): Promise<ReminderSettingsDto> {
    return this.settings.update(salonId, body);
  }
}
