import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  type INestApplication,
  Module,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { Salon, Staff } from '../src/database/entities/index.js';
import { CurrentSalon, findOwnedOrFail } from '../src/tenancy/index.js';
import { deleteSalonData } from '../src/salons/salon-deletion.service.js';
import { auditRouteTenancy } from '../src/tenancy/route-tenancy-audit.js';

/** Minimal tenant-scoped controller used to prove the isolation mechanics end to end. */
@Controller('__test/staff')
class TestStaffController {
  constructor(@InjectRepository(Staff) private readonly staff: Repository<Staff>) {}

  @Get(':id')
  findOne(@CurrentSalon() salonId: string, @Param('id', ParseUUIDPipe) id: string) {
    return findOwnedOrFail(this.staff, id, salonId);
  }

  @Get()
  list(@CurrentSalon() salonId: string) {
    return this.staff.find({ where: { salonId }, order: { name: 'ASC' } });
  }
}

@Module({ imports: [TypeOrmModule.forFeature([Staff])], controllers: [TestStaffController] })
class TestStaffModule {}

describe('multi-tenant isolation (e2e)', () => {
  describe('route coverage', () => {
    it('every authenticated route is tenant-scoped or explicitly tenant-agnostic', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule, DiscoveryModule],
      }).compile();
      const app = await moduleRef.createNestApplication().init();
      try {
        const routes = auditRouteTenancy(app.get(DiscoveryService), app.get(Reflector));
        expect(routes.length).toBeGreaterThan(0);
        const unscoped = routes.filter((r) => r.kind === 'unscoped');
        expect(unscoped, `Unscoped routes: ${JSON.stringify(unscoped)}`).toEqual([]);
      } finally {
        await app.close();
      }
    });
  });

  describe('cross-salon access', () => {
    let app: INestApplication;
    let ds: DataSource;
    let salonA: Salon;
    let salonB: Salon;
    let staffA: Staff;
    let staffB: Staff;
    let tokenA: string;

    const http = () => request(app.getHttpServer());

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule, TestStaffModule],
      }).compile();
      app = await configureApp(moduleRef.createNestApplication()).init();
      ds = app.get(DataSource);

      [salonA, salonB] = await ds.getRepository(Salon).save([
        { name: 'Salon A', slug: `tenancy-a-${randomUUID()}` },
        { name: 'Salon B', slug: `tenancy-b-${randomUUID()}` },
      ]);
      [staffA, staffB] = await ds.getRepository(Staff).save([
        { salonId: salonA.id, name: 'Staff of A' },
        { salonId: salonB.id, name: 'Staff of B' },
      ]);
      tokenA = app.get(JwtService).sign({ sub: randomUUID(), salonId: salonA.id });
    });

    afterAll(async () => {
      if (ds) for (const id of [salonA.id, salonB.id]) await deleteSalonData(ds.manager, id);
      await app?.close();
    });

    it('reads a record of its own salon', async () => {
      const res = await http()
        .get(`/__test/staff/${staffA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.name).toBe('Staff of A');
    });

    it('gets 404 (not the data) for a record of another salon', async () => {
      const res = await http()
        .get(`/__test/staff/${staffB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(JSON.stringify(res.body)).not.toContain('Staff of B');
    });

    it('only lists records of its own salon', async () => {
      const res = await http()
        .get('/__test/staff')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.map((s: Staff) => s.id)).toEqual([staffA.id]);
    });

    it('rejects a token whose salonId was tampered with', async () => {
      const [header, , signature] = tokenA.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: randomUUID(), salonId: salonB.id, exp: 9999999999 }),
      ).toString('base64url');
      await http()
        .get(`/__test/staff/${staffB.id}`)
        .set('Authorization', `Bearer ${header}.${forgedPayload}.${signature}`)
        .expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const foreign = new JwtService({ secret: 'another-secret-another-secret-123' }).sign({
        sub: randomUUID(),
        salonId: salonB.id,
      });
      await http()
        .get(`/__test/staff/${staffB.id}`)
        .set('Authorization', `Bearer ${foreign}`)
        .expect(401);
    });

    it('rejects an authenticated token without salon context', async () => {
      const noSalon = app.get(JwtService).sign({ sub: randomUUID() });
      await http().get('/__test/staff').set('Authorization', `Bearer ${noSalon}`).expect(401);
    });
  });
});
