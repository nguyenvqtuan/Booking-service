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
  type StaffDto,
  staffInputSchema,
  type StaffInputParsed,
  staffUpdateSchema,
  type StaffUpdateParsed,
} from '@booking/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentSalon } from '../tenancy/index.js';
import { StaffMembersService } from './staff.service.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffMembersService) {}

  @Get()
  list(
    @CurrentSalon() salonId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive = false,
  ): Promise<StaffDto[]> {
    return this.staff.list(salonId, includeInactive);
  }

  @Get(':id')
  get(@CurrentSalon() salonId: string, @Param('id', ParseUUIDPipe) id: string): Promise<StaffDto> {
    return this.staff.get(salonId, id);
  }

  @Post()
  create(
    @CurrentSalon() salonId: string,
    @Body(new ZodValidationPipe(staffInputSchema)) body: StaffInputParsed,
  ): Promise<StaffDto> {
    return this.staff.create(salonId, body);
  }

  @Patch(':id')
  update(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(staffUpdateSchema)) body: StaffUpdateParsed,
  ): Promise<StaffDto> {
    return this.staff.update(salonId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentSalon() salonId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.staff.remove(salonId, id);
  }
}
