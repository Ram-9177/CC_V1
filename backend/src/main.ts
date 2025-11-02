import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Security headers with optional CSP
  const enableCsp = process.env.CSP_ENABLE === 'true';
  if (enableCsp) {
    const connectExtra = (process.env.CSP_CONNECT || '').split(',').map(s => s.trim()).filter(Boolean);
    app.use(helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", ...connectExtra],
          frameAncestors: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
      frameguard: { action: 'sameorigin' },
      referrerPolicy: { policy: 'no-referrer' },
    }));
  } else {
    app.use(helmet({ contentSecurityPolicy: false }));
  }

  // Body size limits to prevent abuse
  const bodyLimit = process.env.BODY_LIMIT || '1mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3000;

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HostelConnect API')
    .setDescription('API documentation for HostelConnect backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}/api`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
