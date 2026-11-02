import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** 200 khi DB phản hồi, 503 khi không kết nối được. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database').withTimeout(1500)]);
  }
}
