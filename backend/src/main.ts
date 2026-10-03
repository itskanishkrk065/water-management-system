import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './modules/common/filters/http-exception.filter';
import { TransformDecimalInterceptor } from './modules/common/interceptors/transform-decimal.interceptor';
import { StructuredLoggerInterceptor } from './modules/common/interceptors/structured-logger.interceptor';

// In-Memory Sliding Window Rate Limiter for Authentication Protection
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function authRateLimiter(req: any, res: any, next: any) {
  if (req.method === 'POST' && req.path === '/api/v1/auth/login') {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (record) {
      if (now > record.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + 60000 });
      } else {
        record.count++;
        if (record.count > 15) {
          res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
          return res.status(429).json({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Too many authentication attempts from this IP address. Please try again after 60 seconds.',
          });
        }
      }
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + 60000 });
    }
  }
  next();
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Security Headers
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // 2. Authentication Rate Limiting
  app.use(authRateLimiter);

  // 3. CORS Configuration
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(','),
    credentials: true,
  });

  // 4. Global Routing Prefix
  app.setGlobalPrefix('api/v1');

  // 5. Global Pipes, Filters, and Observability Interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new TransformDecimalInterceptor(),
    new StructuredLoggerInterceptor(),
  );

  // 6. Swagger OpenAPI Documentation (Enabled in Development & Staging)
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Water Management System API')
      .setDescription('Production-Grade V2 Monolith API with Dual SQLite/PostgreSQL Engine')
      .setVersion('2.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('📚 Swagger documentation available at /api/docs');
  }

  // 7. Configurable Host Binding
  const port = process.env.PORT || 4000;
  const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');

  await app.listen(port, host);
  logger.log(`🚀 WaterGrid Backend running on http://${host}:${port}/api/v1 (ENV: ${process.env.NODE_ENV || 'development'})`);
}

bootstrap().catch((err) => {
  console.error('==============================================');
  console.error('[NestJS Bootstrap Fatal Error]:', err?.message || err);
  if (err?.stack) {
    console.error('[NestJS Stack]:', err.stack);
  }
  console.error('==============================================');
  process.exit(1);
});

