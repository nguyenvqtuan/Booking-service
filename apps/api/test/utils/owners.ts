import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { deleteSalonData } from '../../src/salons/salon-deletion.service.js';
import type { TestApp } from './test-app.js';

export interface TestOwner {
  token: string;
  salonId: string;
  /** Supertest agent bound to this owner's bearer token. */
  get(url: string): request.Test;
  post(url: string): request.Test;
  patch(url: string): request.Test;
  put(url: string): request.Test;
  delete(url: string): request.Test;
}

/** Registers salon owners through the API and deletes their salons afterwards. */
export class OwnerFactory {
  private readonly salonIds: string[] = [];

  constructor(private readonly t: TestApp) {}

  async create(): Promise<TestOwner> {
    const res = await request(this.t.app.getHttpServer())
      .post('/auth/register')
      .send({
        salonName: 'Test Salon',
        fullName: 'Test Owner',
        email: `owner-${randomUUID()}@example.com`,
        password: 'correct-horse-1',
      })
      .expect(201);
    const token = res.body.accessToken as string;
    this.salonIds.push(res.body.user.salonId);
    const server = this.t.app.getHttpServer();
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
    return {
      token,
      salonId: res.body.user.salonId,
      get: (url) => auth(request(server).get(url)),
      post: (url) => auth(request(server).post(url)),
      patch: (url) => auth(request(server).patch(url)),
      put: (url) => auth(request(server).put(url)),
      delete: (url) => auth(request(server).delete(url)),
    };
  }

  async cleanup(): Promise<void> {
    for (const id of this.salonIds) await deleteSalonData(this.t.dataSource.manager, id);
  }
}
