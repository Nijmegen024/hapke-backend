import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.PORT || 3000;
  console.log('JWT_SECRET length at boot:', process.env.JWT_SECRET?.length);

  await app.listen(port);

  const publicUrl =
    process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  console.log(`🚀 API running on ${publicUrl}`);
}

void bootstrap();
