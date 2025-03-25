import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ArtifactDocument = Artifact & Document;

@Schema({ timestamps: true })
export class Artifact {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent', required: true })
  agentId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AgentResult', required: true })
  resultId: MongooseSchema.Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: ['image', 'video', 'gif', 'json', 'text', 'html'],
    required: true
  })
  type: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  contentType: string;

  @Prop({ required: true })
  size: number;
}

export const ArtifactSchema = SchemaFactory.createForClass(Artifact); 