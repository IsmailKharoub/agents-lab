import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PresetPromptDocument = PresetPrompt & Document;

@Schema({ timestamps: true })
export class PresetPrompt {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  icon: string;

  @Prop({ required: true })
  iconColor: string;

  @Prop({ required: true })
  tag: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  instruction: string;
}

export const PresetPromptSchema = SchemaFactory.createForClass(PresetPrompt); 