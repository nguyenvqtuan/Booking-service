import { Test } from '@nestjs/testing';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('returns service info', async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [AppController] }).compile();
    const controller = moduleRef.get(AppController);
    expect(controller.info()).toEqual({
      name: 'booking-service-api',
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });
});
