import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max, IsEnum } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  instruction: string;

  @IsString()
  @IsNotEmpty()
  modelName: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1000)
  maxSteps: number = 50;

  @IsBoolean()
  @IsOptional()
  headless: boolean = false;

  @IsBoolean()
  @IsOptional()
  useVision: boolean = false;

  @IsBoolean()
  @IsOptional()
  generateGif: boolean = false;

  @IsString()
  @IsOptional()
  @IsEnum(['mobile', 'tablet', 'pc'])
  browserSize: string = 'mobile';

  @IsString()
  @IsOptional()
  userId?: string;
} 