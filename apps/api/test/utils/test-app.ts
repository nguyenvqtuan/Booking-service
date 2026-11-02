import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/common/configure-app.js';
import { type MailMessage, MailService } from '../../src/mail/mail.service.js';

/** MailService double that records messages instead of sending them. */
export class CapturingMailService {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  mail: CapturingMailService;
}

export async function createTestApp(): Promise<TestApp> {
  const mail = new CapturingMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return { app, dataSource: app.get(DataSource), mail };
}
