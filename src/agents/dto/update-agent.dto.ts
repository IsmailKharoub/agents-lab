import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { AgentStatus } from '../../common/types/agent.types';

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  instruction?: string;

  @IsString()
  @IsOptional()
  modelName?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1000)
  maxSteps?: number;

  @IsBoolean()
  @IsOptional()
  headless?: boolean;

  @IsBoolean()
  @IsOptional()
  useVision?: boolean;

  @IsBoolean()
  @IsOptional()
  generateGif?: boolean;

  @IsEnum(AgentStatus)
  @IsOptional()
  status?: AgentStatus;
} 