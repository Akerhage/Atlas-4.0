import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global prefix for API routes (but not static files or websockets)
  app.setGlobalPrefix('api', {
    exclude: [
      '/',
      '/kundchatt/(.*)',
      '/widget.js',
      '/demo',
      '/webhook/(.*)',
      '/team/(.*)',
      '/search_all',
      '/socket.io/(.*)',
    ],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Atlas NestJS server running on port ${port}`);
}

bootstrap();
