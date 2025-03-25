import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentDocument } from './schemas/agent.schema';
import { AgentResult, AgentResultDocument } from './schemas/agent-result.schema';
import { AgentLog, AgentLogDocument } from './schemas/agent-log.schema';
import { Artifact, ArtifactDocument } from './schemas/artifact.schema';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { QueryAgentDto } from './dto/query-agent.dto';
import { AgentStatus } from '../common/types/agent.types';
import { PaginatedResponse } from '../common/types/response.types';
import { WebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel(AgentResult.name) private agentResultModel: Model<AgentResultDocument>,
    @InjectModel(AgentLog.name) private agentLogModel: Model<AgentLogDocument>,
    @InjectModel(Artifact.name) private artifactModel: Model<ArtifactDocument>,
    private webSocketGateway: WebSocketGateway,
  ) {}

  async create(createAgentDto: CreateAgentDto): Promise<Agent> {
    const newAgent = new this.agentModel({
      ...createAgentDto,
      status: AgentStatus.PENDING,
    });
    const agent = await newAgent.save();
    return agent;
  }

  async findAll(queryDto: QueryAgentDto): Promise<PaginatedResponse<Agent>> {
    const { limit = 20, offset = 0, status, sort = 'createdAt', order = 'desc' } = queryDto;
    
    const query = status ? { status } : {};
    const total = await this.agentModel.countDocuments(query);
    const sortOptions: Record<string, 1 | -1> = { [sort as string]: order === 'asc' ? 1 : -1 };
    
    const agents = await this.agentModel.find(query)
      .sort(sortOptions)
      .skip(offset)
      .limit(limit)
      .exec();
    
    return {
      items: agents,
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string): Promise<Agent> {
    const agent = await this.agentModel.findById(id).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  async update(id: string, updateAgentDto: UpdateAgentDto): Promise<Agent> {
    const agent = await this.agentModel.findByIdAndUpdate(
      id, 
      updateAgentDto, 
      { new: true }
    ).exec();
    
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    
    return agent;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.agentModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    
    // Clean up related records
    await this.agentResultModel.deleteMany({ agentId: new Types.ObjectId(id) }).exec();
    await this.agentLogModel.deleteMany({ agentId: new Types.ObjectId(id) }).exec();
    await this.artifactModel.deleteMany({ agentId: new Types.ObjectId(id) }).exec();
    
    return true;
  }

  async updateAgentStatus(id: string, status: AgentStatus): Promise<boolean> {
    const updateData: Partial<Agent> = { status };
    
    // If completed, set the completedAt date
    if (status === AgentStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }
    
    const agent = await this.agentModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).exec();
    
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    
    // Emit WebSocket event
    this.webSocketGateway.emitAgentStatusUpdate(
      id, 
      status, 
      agent.currentStep || 0
    );
    
    return true;
  }

  async getAgentLogs(agentId: string, limit: number = 100, offset: number = 0, level?: string): Promise<PaginatedResponse<AgentLog>> {
    const query = level ? { agentId, level } : { agentId };
    const total = await this.agentLogModel.countDocuments(query);
    
    const logs = await this.agentLogModel.find(query)
      .sort({ timestamp: 1 })
      .skip(offset)
      .limit(limit)
      .exec();
    
    return {
      items: logs,
      total,
      limit,
      offset,
    };
  }

  async getAgentResults(agentId: string): Promise<AgentResult> {
    const result = await this.agentResultModel.findOne({ agentId }).exec();
    if (!result) {
      throw new NotFoundException(`Results for agent with ID ${agentId} not found`);
    }
    return result;
  }

  async getAgentArtifacts(agentId: string, type?: string): Promise<Artifact[]> {
    const query = type ? { agentId, type } : { agentId };
    return this.artifactModel.find(query).exec();
  }

  async addAgentLog(
    agentId: string, 
    level: string, 
    message: string, 
    stepNumber: number, 
    details?: Record<string, any>, 
    url?: string, 
    screenshot?: string
  ): Promise<AgentLog> {
    const newLog = new this.agentLogModel({
      agentId: new Types.ObjectId(agentId),
      level,
      message,
      stepNumber,
      details,
      url,
      screenshot,
      timestamp: new Date().toISOString(),
    });
    
    const log = await newLog.save();
    
    // Update agent's current step
    await this.agentModel.findByIdAndUpdate(
      agentId,
      { currentStep: stepNumber },
      { new: true }
    ).exec();
    
    // Emit WebSocket event
    this.webSocketGateway.emitAgentLogUpdate(agentId, log);
    
    return log;
  }
} 