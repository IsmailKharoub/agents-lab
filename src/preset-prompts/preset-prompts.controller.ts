import { Controller, Get, Param, HttpStatus, HttpException } from '@nestjs/common';
import { PresetPromptsService } from './preset-prompts.service';
import { ApiResponse } from '../common/types/response.types';
import { PresetPrompt } from './schemas/preset-prompt.schema';

@Controller('preset-prompts')
export class PresetPromptsController {
  constructor(private readonly presetPromptsService: PresetPromptsService) {}

  @Get()
  async findAll(): Promise<ApiResponse<{ presetPrompts: PresetPrompt[] }>> {
    try {
      const presetPrompts = await this.presetPromptsService.findAll();
      return {
        status: 'success',
        data: { presetPrompts },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: 'Failed to fetch preset prompts',
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse<{ presetPrompt: PresetPrompt }>> {
    try {
      const presetPrompt = await this.presetPromptsService.findOne(id);
      return {
        status: 'success',
        data: { presetPrompt },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: `Failed to fetch preset prompt with id ${id}`,
        details: error.message,
      }, HttpStatus.NOT_FOUND);
    }
  }

  // Additional endpoints for creating, updating, and deleting preset prompts
  // would be implemented here in a full implementation
} 