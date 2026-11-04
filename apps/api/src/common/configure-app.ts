import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/** App-level middleware shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (hops > 0) (app as NestExpressApplication).set('trust proxy', hops);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  return app;
}
