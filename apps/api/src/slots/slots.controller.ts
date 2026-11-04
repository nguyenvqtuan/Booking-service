import { Controller, Get, Query } from '@nestjs/common';
import { type SlotDto, slotQuerySchema } from '@booking/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentSalon } from '../tenancy/index.js';
import { SlotsService } from './slots.service.js';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get()
  find(
    @CurrentSalon() salonId: string,
    @Query(new ZodValidationPipe(slotQuerySchema)) query: z.output<typeof slotQuerySchema>,
  ): Promise<SlotDto[]> {
    return this.slots.find(salonId, query);
  }
}
