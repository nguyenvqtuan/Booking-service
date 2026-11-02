import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** App-level middleware shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  return app;
}
