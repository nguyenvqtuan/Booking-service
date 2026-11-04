import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  actionSlotsQuerySchema,
  AppointmentStatus,
  type AppointmentActionView,
  rescheduleByLinkSchema,
  type RescheduleByLink,
  type SlotDto,
} from '@booking/shared';
import type { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AppointmentActionsService } from './appointment-actions.service.js';

/** Actions a customer takes from the link in a reminder; the token is the only credential. */
@Public()
@Controller('appointment-actions/:token')
export class AppointmentActionsController {
  constructor(private readonly actions: AppointmentActionsService) {}

  @Get()
  view(@Param('token') token: string): Promise<AppointmentActionView> {
    return this.actions.view(token);
  }

  @Get('slots')
  slots(
    @Param('token') token: string,
    @Query(new ZodValidationPipe(actionSlotsQuerySchema))
    query: z.output<typeof actionSlotsQuerySchema>,
  ): Promise<SlotDto[]> {
    return this.actions.slots(token, query.date);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('token') token: string): Promise<AppointmentActionView> {
    return this.actions.changeStatus(token, AppointmentStatus.Confirmed);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('token') token: string): Promise<AppointmentActionView> {
    return this.actions.changeStatus(token, AppointmentStatus.Cancelled);
  }

  @Post('reschedule')
  @HttpCode(HttpStatus.OK)
  reschedule(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(rescheduleByLinkSchema)) body: RescheduleByLink,
  ): Promise<AppointmentActionView> {
    return this.actions.reschedule(token, body.startAt);
  }
}
