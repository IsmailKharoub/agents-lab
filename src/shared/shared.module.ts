import { Global, Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Agent, AgentSchema } from '../agents/schemas/agent.schema';
import { AgentResult, AgentResultSchema } from '../agents/schemas/agent-result.schema';
import { AgentLog, AgentLogSchema } from '../agents/schemas/agent-log.schema';
import { Artifact, ArtifactSchema } from '../agents/schemas/artifact.schema';
import { AgentsService } from '../agents/agents.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { PythonAgentService } from '../agents/python-agent.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: AgentResult.name, schema: AgentResultSchema },
      { name: AgentLog.name, schema: AgentLogSchema },
      { name: Artifact.name, schema: ArtifactSchema },
    ]),
    WebSocketModule,
  ],
  providers: [AgentsService, PythonAgentService],
  exports: [AgentsService, PythonAgentService, MongooseModule],
})
export class SharedModule {} 