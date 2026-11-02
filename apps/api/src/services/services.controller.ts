import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type ServiceDto,
  type ServiceInput,
  serviceInputSchema,
  type ServiceUpdate,
  serviceUpdateSchema,
} from '@booking/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentSalon } from '../tenancy/index.js';
import { ServicesService } from './services.service.js';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(
    @CurrentSalon() salonId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive = false,
  ): Promise<ServiceDto[]> {
    return this.services.list(salonId, includeInactive);
  }

  @Post()
  create(
    @CurrentSalon() salonId: string,
    @Body(new ZodValidationPipe(serviceInputSchema)) body: ServiceInput,
  ): Promise<ServiceDto> {
    return this.services.create(salonId, body);
  }

  @Patch(':id')
  update(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(serviceUpdateSchema)) body: ServiceUpdate,
  ): Promise<ServiceDto> {
    return this.services.update(salonId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentSalon() salonId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.services.remove(salonId, id);
  }
}
