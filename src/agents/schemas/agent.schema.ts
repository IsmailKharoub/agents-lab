import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AgentStatus } from '../../common/types/agent.types';

export type AgentDocument = Agent & Document;

@Schema({ timestamps: true })
export class Agent extends Document {
  @Prop({ required: true })
  instruction: string;

  @Prop({ 
    type: String, 
    enum: Object.values(AgentStatus), 
    default: AgentStatus.IDLE 
  })
  status: AgentStatus;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ required: true })
  modelName: string;

  @Prop({ required: true, default: 50 })
  maxSteps: number;

  @Prop({ required: true, default: false })
  headless: boolean;

  @Prop({ required: true, default: false })
  useVision: boolean;

  @Prop({ required: true, default: false })
  generateGif: boolean;

  @Prop({ required: true, default: 'mobile' })
  browserSize: string;

  @Prop()
  userId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AgentResult' })
  results?: MongooseSchema.Types.ObjectId;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'AgentLog' }] })
  logs?: MongooseSchema.Types.ObjectId[];

  @Prop({ default: 0 })
  currentStep?: number;

  @Prop({ type: Object, default: null })
  result: Record<string, any>;

  @Prop({ type: String, default: null })
  error: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const AgentSchema = SchemaFactory.createForClass(Agent); 