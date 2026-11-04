import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  type OtpRequestParsed,
  otpRequestSchema,
  publicBookingSchema,
  type PublicBookingParsed,
  type PublicBookingResult,
  type PublicSalonDto,
  type PublicServiceDto,
  type PublicStaffDto,
  publicStaffQuerySchema,
  type SlotDto,
  slotQuerySchema,
} from '@booking/shared';
import type { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PublicBookingService } from './public-booking.service.js';

@Public()
@UseGuards(ThrottlerGuard)
@Controller('public/:slug')
export class PublicBookingController {
  constructor(private readonly booking: PublicBookingService) {}

  @Get()
  salon(@Param('slug') slug: string): Promise<PublicSalonDto> {
    return this.booking.salon(slug);
  }

  @Get('services')
  services(@Param('slug') slug: string): Promise<PublicServiceDto[]> {
    return this.booking.services(slug);
  }

  @Get('staff')
  staff(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(publicStaffQuerySchema))
    query: z.output<typeof publicStaffQuerySchema>,
  ): Promise<PublicStaffDto[]> {
    return this.booking.staff(slug, query.serviceId);
  }

  @Get('slots')
  slots(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(slotQuerySchema)) query: z.output<typeof slotQuerySchema>,
  ): Promise<SlotDto[]> {
    return this.booking.freeSlots(slug, query);
  }

  @Post('otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  requestOtp(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequestParsed,
  ): Promise<void> {
    return this.booking.requestOtp(slug, body.phone);
  }

  @Post('appointments')
  book(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(publicBookingSchema)) body: PublicBookingParsed,
  ): Promise<PublicBookingResult> {
    return this.booking.book(slug, body);
  }
}
