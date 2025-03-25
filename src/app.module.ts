import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { PresetPromptsModule } from './preset-prompts/preset-prompts.module';
import { CredentialsModule } from './credentials/credentials.module';
import { WebSocketModule } from './websocket/websocket.module';
import { DaemonModule } from './daemon/daemon.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { SharedModule } from './shared/shared.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/webagent',
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
        maxAge: 86400000, // 1 day caching
      },
    }),
    SharedModule,
    AgentsModule,
    PresetPromptsModule,
    CredentialsModule,
    WebSocketModule,
    DaemonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
