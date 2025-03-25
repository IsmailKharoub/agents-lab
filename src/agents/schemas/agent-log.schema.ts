import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AgentLogDocument = AgentLog & Document;

@Schema({ timestamps: true })
export class AgentLog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent', required: true })
  agentId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  stepNumber: number;

  @Prop({ 
    type: String, 
    enum: ['info', 'warning', 'error', 'debug'],
    default: 'info'
  })
  level: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  details?: Record<string, any>;

  @Prop({ required: true, default: () => new Date().toISOString() })
  timestamp: string;

  @Prop()
  url?: string;

  @Prop()
  screenshot?: string;
}

export const AgentLogSchema = SchemaFactory.createForClass(AgentLog); 