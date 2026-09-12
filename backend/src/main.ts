import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
import { AppModule } from './app.module';

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.includes(origin)) return true;

  // Vercel preview + production deployments
  if (/^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin)) return true;

  return false;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
  app.use(compression());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  const port = Number(process.env.PORT) || 3000;
  // Bind all interfaces so Render health checks can detect the open port
  await app.listen(port, '0.0.0.0');
  console.log(`Agent 58 API listening on http://0.0.0.0:${port}/api`);
}
bootstrap();
