import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PresetPrompt } from './schemas/preset-prompt.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PresetPromptsService {
  constructor(
    @InjectModel(PresetPrompt.name) private presetPromptModel: Model<PresetPrompt>,
  ) {}

  async findAll(): Promise<PresetPrompt[]> {
    return this.presetPromptModel.find().exec();
  }

  async findOne(id: string): Promise<PresetPrompt> {
    const presetPrompt = await this.presetPromptModel.findById(id).exec();
    if (!presetPrompt) {
      throw new NotFoundException(`Preset prompt with ID ${id} not found`);
    }
    return presetPrompt;
  }

  // Additional methods for creating, updating, and deleting preset prompts
  // would be implemented here in a full implementation
} 