import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  appointmentCreateSchema,
  type AppointmentCreateParsed,
  type AppointmentDto,
  appointmentListQuerySchema,
  appointmentStatusSchema,
  type AppointmentStatusChange,
  appointmentUpdateSchema,
  type AppointmentUpdateParsed,
} from '@booking/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentSalon } from '../tenancy/index.js';
import { AppointmentsService } from './appointments.service.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(
    @CurrentSalon() salonId: string,
    @Query(new ZodValidationPipe(appointmentListQuerySchema))
    query: z.output<typeof appointmentListQuerySchema>,
  ): Promise<AppointmentDto[]> {
    return this.appointments.list(salonId, query);
  }

  @Get(':id')
  get(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentDto> {
    return this.appointments.get(salonId, id);
  }

  @Post()
  create(
    @CurrentSalon() salonId: string,
    @Body(new ZodValidationPipe(appointmentCreateSchema)) body: AppointmentCreateParsed,
  ): Promise<AppointmentDto> {
    return this.appointments.create(salonId, body);
  }

  @Patch(':id')
  update(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(appointmentUpdateSchema)) body: AppointmentUpdateParsed,
  ): Promise<AppointmentDto> {
    return this.appointments.update(salonId, id, body);
  }

  @Post(':id/no-show')
  @HttpCode(HttpStatus.OK)
  markNoShow(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentDto> {
    return this.appointments.markNoShow(salonId, id);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  changeStatus(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(appointmentStatusSchema)) body: AppointmentStatusChange,
  ): Promise<AppointmentDto> {
    return this.appointments.changeStatus(salonId, id, body.status);
  }
}
