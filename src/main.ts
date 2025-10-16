import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = '0.0.0.0';
  await app.listen(port, host);

  const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on ${publicUrl}`);
}

bootstrap();
