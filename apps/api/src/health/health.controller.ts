import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../auth/public.decorator.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** 200 when the database responds, 503 when it is unreachable. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database').withTimeout(1500)]);
  }
}
