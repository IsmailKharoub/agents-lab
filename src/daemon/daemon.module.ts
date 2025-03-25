import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DaemonService } from './daemon.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    ConfigModule,
    WebSocketModule,
    forwardRef(() => AgentsModule),
  ],
  providers: [DaemonService],
  exports: [DaemonService],
})
export class DaemonModule {} 