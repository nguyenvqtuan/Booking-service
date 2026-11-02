import { Controller, Get } from '@nestjs/common';
import { DEFAULT_TIMEZONE } from '@booking/shared';

@Controller()
export class AppController {
  @Get()
  info() {
    return { name: 'booking-service-api', timezone: DEFAULT_TIMEZONE };
  }
}
