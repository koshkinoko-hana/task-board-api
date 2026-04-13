import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnvFile } from './load-env';
import { setupSwagger } from './setup-swagger';

loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const swaggerOk = setupSwagger(app);
  const rawPort = process.env.PORT;
  const parsed =
    rawPort !== undefined && rawPort !== '' ? Number(rawPort) : NaN;
  const port = Number.isFinite(parsed) && parsed >= 0 ? parsed : 3000;
  await app.listen(port);
  if (swaggerOk) {
    Logger.log(`Swagger UI: http://localhost:${port}/docs`, 'Bootstrap');
  }
}
bootstrap();
