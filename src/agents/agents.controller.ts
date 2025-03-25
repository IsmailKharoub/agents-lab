import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Patch, 
  Query, 
  HttpStatus,
  HttpException
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';
import { DaemonService } from '../daemon/daemon.service';
import { ApiResponse, PaginatedResponse } from '../common/types/response.types';
import { Agent as AgentInterface, AgentLog as AgentLogInterface, AgentResult as AgentResultInterface, Artifact as ArtifactInterface } from '../common/types/agent.types';
import { Agent, AgentDocument } from './schemas/agent.schema';
import { AgentLog, AgentLogDocument } from './schemas/agent-log.schema';
import { AgentResult, AgentResultDocument } from './schemas/agent-result.schema';
import { Artifact, ArtifactDocument } from './schemas/artifact.schema';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly daemonService: DaemonService,
  ) {}

  @Post()
  async create(@Body() createAgentDto: CreateAgentDto): Promise<ApiResponse<{ agent: AgentInterface }>> {
    try {
      const agent = await this.agentsService.create(createAgentDto);
      return {
        status: 'success',
        data: { agent: this.mapAgentToInterface(agent) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: 'Failed to create agent',
        details: error.message,
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  async findAll(@Query() queryDto: QueryAgentDto): Promise<ApiResponse<PaginatedResponse<AgentInterface>>> {
    try {
      const result = await this.agentsService.findAll(queryDto);
      return {
        status: 'success',
        data: {
          items: result.items.map(agent => this.mapAgentToInterface(agent)),
          total: result.total,
          limit: result.limit,
          offset: result.offset
        },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: 'Failed to fetch agents',
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse<{ agent: AgentInterface }>> {
    try {
      const agent = await this.agentsService.findOne(id);
      return {
        status: 'success',
        data: { agent: this.mapAgentToInterface(agent) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to fetch agent with id ${id}`,
        details: error.message,
      }, HttpStatus.NOT_FOUND);
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateAgentDto: UpdateAgentDto
  ): Promise<ApiResponse<{ agent: AgentInterface }>> {
    try {
      const agent = await this.agentsService.update(id, updateAgentDto);
      return {
        status: 'success',
        data: { agent: this.mapAgentToInterface(agent) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to update agent with id ${id}`,
        details: error.message,
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    try {
      await this.agentsService.remove(id);
      return {
        status: 'success',
        message: 'Agent deleted successfully',
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to delete agent with id ${id}`,
        details: error.message,
      }, HttpStatus.NOT_FOUND);
    }
  }

  @Post(':id/start')
  async startAgent(@Param('id') id: string): Promise<ApiResponse<{ agent: AgentInterface }>> {
    try {
      const success = await this.daemonService.startAgent(id);
      if (!success) {
        throw new Error('Failed to start agent process');
      }
      
      const agent = await this.agentsService.findOne(id);
      return {
        status: 'success',
        message: 'Agent started successfully',
        data: { agent: this.mapAgentToInterface(agent) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to start agent with id ${id}`,
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/stop')
  async stopAgent(@Param('id') id: string): Promise<ApiResponse<{ agent: AgentInterface }>> {
    try {
      const success = await this.daemonService.stopAgent(id);
      if (!success) {
        throw new Error('Failed to stop agent process');
      }
      
      const agent = await this.agentsService.findOne(id);
      return {
        status: 'success',
        message: 'Agent stopped successfully',
        data: { agent: this.mapAgentToInterface(agent) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to stop agent with id ${id}`,
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/pause')
  async pauseAgent(@Param('id') id: string): Promise<ApiResponse<{ agent: AgentInterface }>> {
    try {
      const success = await this.daemonService.pauseAgent(id);
      if (!success) {
        throw new Error('Failed to pause agent process');
      }
      
      const agent = await this.agentsService.findOne(id);
      return {
        status: 'success',
        message: 'Agent paused successfully',
        data: { agent: this.mapAgentToInterface(agent) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to pause agent with id ${id}`,
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/resume')
  async resumeAgent(@Param('id') id: string): Promise<ApiResponse<{ agent: AgentInterface }>> {
    try {
      const success = await this.daemonService.resumeAgent(id);
      if (!success) {
        throw new Error('Failed to resume agent process');
      }
      
      const agent = await this.agentsService.findOne(id);
      return {
        status: 'success',
        message: 'Agent resumed successfully',
        data: { agent: this.mapAgentToInterface(agent) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to resume agent with id ${id}`,
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/logs')
  async getAgentLogs(
    @Param('id') id: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
    @Query('level') level?: string
  ): Promise<ApiResponse<PaginatedResponse<AgentLogInterface>>> {
    try {
      const logs = await this.agentsService.getAgentLogs(id, limit, offset, level);
      return {
        status: 'success',
        data: {
          items: logs.items.map(log => this.mapLogToInterface(log)),
          total: logs.total,
          limit: logs.limit,
          offset: logs.offset
        },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to fetch logs for agent with id ${id}`,
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/results')
  async getAgentResults(@Param('id') id: string): Promise<ApiResponse<{ results: AgentResultInterface }>> {
    try {
      const results = await this.agentsService.getAgentResults(id);
      return {
        status: 'success',
        data: { results: this.mapResultToInterface(results) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to fetch results for agent with id ${id}`,
        details: error.message,
      }, HttpStatus.NOT_FOUND);
    }
  }

  @Get(':id/artifacts')
  async getAgentArtifacts(
    @Param('id') id: string,
    @Query('type') type?: string
  ): Promise<ApiResponse<{ artifacts: ArtifactInterface[] }>> {
    try {
      const artifacts = await this.agentsService.getAgentArtifacts(id, type);
      return {
        status: 'success',
        data: { artifacts: artifacts.map(artifact => this.mapArtifactToInterface(artifact)) },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to fetch artifacts for agent with id ${id}`,
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Helper methods to map schema models to interface types
  private mapAgentToInterface(agent: Agent & { _id?: any, createdAt?: Date, updatedAt?: Date }): AgentInterface {
    return {
      id: agent._id?.toString() || '',
      instruction: agent.instruction,
      status: agent.status,
      createdAt: agent.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: agent.updatedAt?.toISOString() || new Date().toISOString(),
      completedAt: agent.completedAt?.toISOString(),
      model: agent.modelName,
      maxSteps: agent.maxSteps,
      headless: agent.headless,
      useVision: agent.useVision,
      generateGif: agent.generateGif,
      userId: agent.userId,
      currentStep: agent.currentStep,
    };
  }
  
  private mapLogToInterface(log: AgentLog & { _id?: any }): AgentLogInterface {
    return {
      id: log._id?.toString() || '',
      agentId: typeof log.agentId === 'object' ? log.agentId.toString() : log.agentId,
      stepNumber: log.stepNumber,
      level: log.level as "info" | "warning" | "error" | "debug",
      message: log.message,
      details: log.details,
      timestamp: log.timestamp,
      url: log.url,
      screenshot: log.screenshot,
    };
  }
  
  private mapResultToInterface(result: AgentResult & { _id?: any, createdAt?: Date }): AgentResultInterface {
    return {
      id: result._id?.toString() || '',
      agentId: typeof result.agentId === 'object' ? result.agentId.toString() : result.agentId,
      summary: result.summary,
      outputText: result.outputText,
      outputHtml: result.outputHtml,
      createdAt: result.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
  
  private mapArtifactToInterface(artifact: Artifact & { _id?: any, createdAt?: Date }): ArtifactInterface {
    return {
      id: artifact._id?.toString() || '',
      agentId: typeof artifact.agentId === 'object' ? artifact.agentId.toString() : artifact.agentId,
      resultId: typeof artifact.resultId === 'object' ? artifact.resultId.toString() : artifact.resultId,
      type: artifact.type as "image" | "video" | "gif" | "json" | "text" | "html",
      url: artifact.url,
      filename: artifact.filename,
      contentType: artifact.contentType,
      size: artifact.size,
      createdAt: artifact.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
} 