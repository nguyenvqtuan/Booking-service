import {
  Body,
  Controller,
  Delete,
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
  type CustomerDetailDto,
  type CustomerDto,
  customerInputSchema,
  type CustomerInputParsed,
  customerListQuerySchema,
  customerUpdateSchema,
  type CustomerUpdateParsed,
  type Page,
} from '@booking/shared';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentSalon } from '../tenancy/index.js';
import { CustomersService } from './customers.service.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(
    @CurrentSalon() salonId: string,
    @Query(new ZodValidationPipe(customerListQuerySchema))
    query: z.output<typeof customerListQuerySchema>,
  ): Promise<Page<CustomerDto>> {
    return this.customers.list(salonId, query);
  }

  @Get(':id')
  get(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerDetailDto> {
    return this.customers.get(salonId, id);
  }

  @Post()
  create(
    @CurrentSalon() salonId: string,
    @Body(new ZodValidationPipe(customerInputSchema)) body: CustomerInputParsed,
  ): Promise<CustomerDto> {
    return this.customers.create(salonId, body);
  }

  @Patch(':id')
  update(
    @CurrentSalon() salonId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(customerUpdateSchema)) body: CustomerUpdateParsed,
  ): Promise<CustomerDto> {
    return this.customers.update(salonId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentSalon() salonId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.customers.remove(salonId, id);
  }
}
