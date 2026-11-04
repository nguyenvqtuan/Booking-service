import { Controller, Get, Query } from '@nestjs/common';
import { type ReportDto, reportQuerySchema } from '@booking/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentSalon } from '../tenancy/index.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(
    @CurrentSalon() salonId: string,
    @Query(new ZodValidationPipe(reportQuerySchema)) query: z.output<typeof reportQuerySchema>,
  ): Promise<ReportDto> {
    return this.reports.summary(salonId, query);
  }
}
