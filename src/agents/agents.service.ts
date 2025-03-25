import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Schema as MongooseSchema } from 'mongoose';
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
import * as path from 'path';
import * as fs from 'fs';

interface AgentLogWithTimestamp extends AgentLog {
  timestamp: string;
}

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
      status: AgentStatus.IDLE,
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
    
    // Set completedAt for terminal states
    if ([AgentStatus.COMPLETED, AgentStatus.FAILED, AgentStatus.STOPPED].includes(status)) {
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
    
    // Emit WebSocket event with maxSteps
    this.webSocketGateway.emitAgentStatusUpdate(
      id, 
      status, 
      agent.currentStep || 0,
      agent.maxSteps
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

  async saveAgentResult(
    agentId: string,
    summary: string,
    outputText: string,
    outputHtml?: string,
    artifacts?: MongooseSchema.Types.ObjectId[]
  ): Promise<AgentResult> {
    // Check if result already exists for this agent
    const existingResult = await this.agentResultModel.findOne({ agentId }).exec();
    
    let savedResult: AgentResult;
    
    if (existingResult) {
      // Update existing result
      existingResult.summary = summary;
      existingResult.outputText = outputText;
      
      if (outputHtml) {
        existingResult.outputHtml = outputHtml;
      }
      
      if (artifacts && artifacts.length > 0) {
        existingResult.artifacts = artifacts;
      }
      
      savedResult = await existingResult.save();
    } else {
      // Create new result
      const newResult = new this.agentResultModel({
        agentId: new Types.ObjectId(agentId),
        summary,
        outputText,
        outputHtml,
        artifacts
      });
      
      savedResult = await newResult.save();
    }
    
    // Emit WebSocket event
    this.webSocketGateway.emitAgentResultUpdate(agentId, savedResult);
    
    return savedResult;
  }

  /**
   * Create artifacts from raw data and associate them with an agent result
   * @param agentId The ID of the agent
   * @param resultId The ID of the result
   * @param artifactData Array of artifact data objects
   * @returns Array of created artifact IDs
   */
  async createArtifactsFromData(
    agentId: string,
    resultId: string,
    artifactData: Array<{
      type: string;
      name: string;
      mimeType: string;
      content?: string;
      url?: string;
    }>
  ): Promise<MongooseSchema.Types.ObjectId[]> {
    if (!artifactData || artifactData.length === 0) {
      return [];
    }

    const artifactIds: MongooseSchema.Types.ObjectId[] = [];
    const savePath = path.join(process.cwd(), 'uploads', 'artifacts', agentId);
    
    // Ensure the save directory exists
    fs.mkdirSync(savePath, { recursive: true });

    for (const data of artifactData) {
      try {
        let url = data.url;
        let size = 0;
        
        // If content is provided, save it to disk
        if (data.content) {
          const filename = `${data.name || `artifact-${Date.now()}`}`;
          const filePath = path.join(savePath, filename);
          
          // Decode base64 content if present
          if (data.content.startsWith('data:') || data.content.includes(';base64,')) {
            const base64Data = data.content.split(';base64,').pop() || '';
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          } else {
            fs.writeFileSync(filePath, data.content);
          }
          
          // Get file size
          const stats = fs.statSync(filePath);
          size = stats.size;
          
          // Create relative URL for the artifact
          url = `/uploads/artifacts/${agentId}/${filename}`;
        }
        
        if (!url) {
          this.logger.warn(`No URL or content found for artifact ${data.name}`);
          continue;
        }
        
        // Create artifact in database
        const artifact = new this.artifactModel({
          agentId: new Types.ObjectId(agentId),
          resultId: new Types.ObjectId(resultId),
          type: data.type || 'unknown',
          url,
          filename: data.name || `artifact-${Date.now()}`,
          contentType: data.mimeType || 'application/octet-stream',
          size
        });
        
        const savedArtifact = await artifact.save();
        artifactIds.push(savedArtifact._id as unknown as MongooseSchema.Types.ObjectId);
      } catch (error) {
        this.logger.error(`Failed to create artifact ${data.name}: ${error.message}`);
      }
    }
    
    return artifactIds;
  }

  /**
   * Get agent execution statistics
   * Returns statistics about the agent's execution, such as duration, steps completed, pages visited, etc.
   */
  async getAgentStats(agentId: string): Promise<any> {
    // Get the agent
    const agent = await this.agentModel.findById(agentId).exec();
    
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }
    
    // Get all logs for the agent
    const logs = await this.agentLogModel.find({ agentId })
      .sort({ timestamp: 1 })
      .exec() as AgentLogWithTimestamp[];
    
    // Calculate start and end times
    const startTime = agent.createdAt;
    const endTime = agent.completedAt || new Date();
    
    // Calculate active duration (excluding paused time)
    let totalPausedTime = 0;
    let lastPauseTime: Date | null = null;
    let lastStatus: string = AgentStatus.IDLE;
    
    // Calculate paused duration from logs
    logs.forEach((log: AgentLogWithTimestamp) => {
      if (log.details?.event === 'status_change' && log.details.status && log.timestamp) {
        const currentStatus = log.details.status as string;
        try {
          const timestamp = new Date(log.timestamp);
          if (isNaN(timestamp.getTime())) {
            this.logger.warn(`Invalid timestamp in log: ${log.timestamp}`);
            return;
          }
          
          if (currentStatus === AgentStatus.PAUSED) {
            lastPauseTime = timestamp;
          } else if (lastPauseTime && lastStatus === AgentStatus.PAUSED) {
            const pauseDuration = timestamp.getTime() - lastPauseTime.getTime();
            if (!isNaN(pauseDuration)) {
              totalPausedTime += pauseDuration;
            }
            lastPauseTime = null;
          }
          lastStatus = currentStatus;
        } catch (error) {
          this.logger.error(`Error processing timestamp: ${error.message}`);
        }
      }
    });
    
    // If still paused, add time until now
    if (lastPauseTime && lastStatus === AgentStatus.PAUSED) {
      try {
        const now = new Date();
        const finalPauseDuration = now.getTime() - (lastPauseTime as Date).getTime();
        if (!isNaN(finalPauseDuration)) {
          totalPausedTime += finalPauseDuration;
        }
      } catch (error) {
        this.logger.error(`Error calculating final pause duration: ${error.message}`);
      }
    }
    
    // Calculate total and active durations
    const totalDurationMs = endTime.getTime() - startTime.getTime();
    const activeDurationMs = Math.max(0, totalDurationMs - totalPausedTime);
    
    // Format durations
    const formatDuration = (ms: number) => {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    };
    
    // Count unique URLs visited
    const uniqueUrls = new Set<string>();
    logs.forEach(log => {
      if (log.url) {
        uniqueUrls.add(log.url);
      }
    });
    
    // Estimate token usage (very rough estimate)
    const tokenUsage = logs.length * 200; // very rough estimate
    
    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalDuration: totalDurationMs,
      activeDuration: activeDurationMs,
      pausedDuration: totalPausedTime,
      formattedTotalDuration: formatDuration(totalDurationMs),
      formattedActiveDuration: formatDuration(activeDurationMs),
      formattedPausedDuration: formatDuration(totalPausedTime),
      stepsCompleted: agent.currentStep || 0,
      maxSteps: agent.maxSteps,
      pagesVisited: uniqueUrls.size,
      logCount: logs.length,
      status: agent.status,
      tokenUsage,
      hasGif: agent.generateGif,
      hasScreenshots: logs.some(log => log.screenshot),
    };
  }

  async updateStep(agentId: string, stepNumber: number): Promise<void> {
    const agent = await this.agentModel.findById(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }
    
    // Validate step progression
    const currentStep = agent.currentStep || 0;
    if (stepNumber <= currentStep) {
      this.logger.warn(`Invalid step progression for agent ${agentId}: ${stepNumber} <= ${currentStep}`);
      return;
    }
    
    // Atomic update with maxStepReached tracking
    await this.agentModel.findByIdAndUpdate(
      agentId,
      { 
        $set: { currentStep: stepNumber },
        $max: { maxStepReached: stepNumber }
      },
      { new: true }
    );
    
    // Emit WebSocket event
    this.webSocketGateway.emitAgentStatusUpdate(
      agentId,
      agent.status,
      stepNumber,
      agent.maxSteps
    );
  }
} 