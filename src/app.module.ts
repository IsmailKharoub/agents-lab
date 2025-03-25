import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module';
import { PresetPromptsModule } from './preset-prompts/preset-prompts.module';
import { CredentialsModule } from './credentials/credentials.module';
import { WebSocketGateway } from './websocket/websocket.gateway';
import { DaemonModule } from './daemon/daemon.module';
import { ServeStaticModule } from '@nestjs/serve-static';
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
    AgentsModule,
    PresetPromptsModule,
    CredentialsModule,
    DaemonModule,
  ],
  controllers: [AppController],
  providers: [AppService, WebSocketGateway],
})
export class AppModule {}
