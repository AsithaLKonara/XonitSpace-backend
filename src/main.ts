import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as express from 'express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Helmet sets secure HTTP headers (XSS, clickjacking, etc.)
  app.use(helmet());

  // Trust reverse proxy headers (required for IP-based rate limiting in production)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Enable Cross-Origin Resource Sharing (CORS)
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  // Serve uploads directory statically
  app.use('/uploads', express.static(join(process.cwd(), 'public/uploads')));

  // Bind global validation pipes with payload sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Bind global exception filters and transformation interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Setup Swagger API Explorer
  const config = new DocumentBuilder()
    .setTitle('Xonit Space E2E Backend API')
    .setDescription('Relational, secure modules governing Auth, HRM, CRM, Projects, Finance, Referrals, and Notifications.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`🚀 Xonit Space Backend is running at: http://localhost:${port}`);
  console.log(`📊 Swagger Interactive API Explorer: http://localhost:${port}/api/docs`);
}
bootstrap();
