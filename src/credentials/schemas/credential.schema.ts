import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CredentialDocument = Credential & Document;

@Schema({ timestamps: true })
export class Credential {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  service: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  password: string; // Should be encrypted at rest

  @Prop({ default: true })
  isActive: boolean;
}

export const CredentialSchema = SchemaFactory.createForClass(Credential); 