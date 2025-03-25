import { IsEnum, IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AgentStatus } from '../../common/types/agent.types';

export class QueryAgentDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  limit?: number = 20;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @IsEnum(AgentStatus)
  @IsOptional()
  status?: AgentStatus;

  @IsString()
  @IsOptional()
  sort?: string = 'createdAt';

  @IsString()
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
} 