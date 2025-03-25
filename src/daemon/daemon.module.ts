import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DaemonService } from './daemon.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    ConfigModule,
    AgentsModule,
  ],
  providers: [DaemonService],
  exports: [DaemonService],
})
export class DaemonModule {} 