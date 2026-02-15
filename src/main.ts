import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global validation pipe — validates all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger / OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Drone Delivery Management API')
    .setDescription(
      'RESTful API for managing drone-based delivery operations. ' +
        'Supports three user roles: admin, enduser, and drone. ' +
        'Includes JWT authentication with signup/signin, session management, and role-based access control.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 Application running on http://localhost:${port}`);
  console.log(`📖 Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();
