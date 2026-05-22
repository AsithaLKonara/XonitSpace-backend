import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import * as express from 'express';
import { join } from 'path';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

async function bootstrap() {
  // Initialize Sentry globally
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Use Pino for Nest logging
  app.useLogger(app.get(Logger));

  // Security: Helmet sets secure HTTP headers
  app.use(helmet());

  // Trust reverse proxy headers (required for IP-based rate limiting in production)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Enable Cross-Origin Resource Sharing (CORS)
  app.enableCors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true,
    credentials: true,
  });

  // Hard HTTP payload size cap: 512KB — blocks multi-KB string injection at transport
  // layer before ValidationPipe or DTOs are even invoked (defense-in-depth).
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ limit: '512kb', extended: true }));

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

  // Global Exception Filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Interceptors
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new TimeoutInterceptor()
  );

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
