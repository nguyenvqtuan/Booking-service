import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  type AccessTokenPayload,
  type CreateSalonInput,
  createSalonSchema,
  DEFAULT_REMINDER_OFFSETS_MIN,
  SalonRole,
  type SalonSummary,
} from '@booking/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { isPgError, PgErrorCode } from '../common/pg-errors.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ReminderSetting, Salon, UserSalon } from '../database/entities/index.js';
import { TenantAgnostic } from '../tenancy/index.js';
import { listUserSalons, uniqueSalonSlug } from './salon-helpers.js';

/** The signed-in user's salons/branches (BS-42). */
@Controller('salons')
export class SalonsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @TenantAgnostic('Lists the salons of the authenticated user')
  list(@CurrentUser() user: AccessTokenPayload): Promise<SalonSummary[]> {
    return listUserSalons(this.dataSource.manager, user.sub);
  }

  @Post()
  @TenantAgnostic('Creates a new salon owned by the authenticated user')
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createSalonSchema)) body: CreateSalonInput,
  ): Promise<SalonSummary> {
    // Two concurrent requests can pick the same free slug; retry so the next one picks "-2".
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.dataSource.transaction(async (em) => {
          const salon = await em.save(
            em.create(Salon, { name: body.name, slug: await uniqueSalonSlug(body.name, em) }),
          );
          await em.insert(ReminderSetting, {
            salonId: salon.id,
            offsets: DEFAULT_REMINDER_OFFSETS_MIN,
          });
          await em.insert(UserSalon, {
            userId: user.sub,
            salonId: salon.id,
            role: SalonRole.Owner,
          });
          return { id: salon.id, name: salon.name, slug: salon.slug, role: SalonRole.Owner };
        });
      } catch (err) {
        if (attempt < 5 && isPgError(err, PgErrorCode.UniqueViolation, 'UQ_salons_slug')) continue;
        throw err;
      }
    }
  }
}
