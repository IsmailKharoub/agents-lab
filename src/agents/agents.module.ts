import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent, AgentSchema } from './schemas/agent.schema';
import { AgentResult, AgentResultSchema } from './schemas/agent-result.schema';
import { AgentLog, AgentLogSchema } from './schemas/agent-log.schema';
import { Artifact, ArtifactSchema } from './schemas/artifact.schema';
import { ApiKeyMiddleware } from '../common/middleware/api-key.middleware';
import { RateLimiterMiddleware } from '../common/middleware/rate-limiter.middleware';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: AgentResult.name, schema: AgentResultSchema },
      { name: AgentLog.name, schema: AgentLogSchema },
      { name: Artifact.name, schema: ArtifactSchema },
    ]),
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware, RateLimiterMiddleware)
      .forRoutes({ path: 'agents*', method: RequestMethod.ALL });
  }
} 