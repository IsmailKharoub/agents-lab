import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AgentResultDocument = AgentResult & Document;

@Schema({ timestamps: true })
export class AgentResult {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent', required: true })
  agentId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  summary: string;

  @Prop({ required: true })
  outputText: string;

  @Prop()
  outputHtml?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Artifact' }] })
  artifacts?: MongooseSchema.Types.ObjectId[];
}

export const AgentResultSchema = SchemaFactory.createForClass(AgentResult); 