import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WebSocketAdapter } from './websocket/websocket.adapter';
import { DaemonService } from './daemon/daemon.service';

async function bootstrap() {
  // Enable debug logging
  const logger = new Logger('Bootstrap');
  logger.log('Starting application...');
  
  // Set logging level to debug during development
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'debug';
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const configService = app.get(ConfigService);
  const daemonService = app.get(DaemonService);
  
  // Use WebSocketAdapter
  app.useWebSocketAdapter(new WebSocketAdapter(app));
  
  // Middleware
  app.use(cookieParser());
  
  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  // CORS
  app.enableCors({
    origin: '*',
    credentials: true,
  });
  
  // API prefix
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);
  
  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    logger.log(`${signal} signal received: closing HTTP server...`);
    
    // Stop the daemon process first
    logger.log('Stopping daemon service...');
    await daemonService.onModuleDestroy();
    
    // Then close the NestJS app
    await app.close();
    logger.log('HTTP server closed');
    process.exit(0);
  };
  
  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Start server
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
