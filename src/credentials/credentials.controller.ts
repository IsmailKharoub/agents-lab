import { Controller, Post, Body, HttpStatus, HttpException } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { ApiResponse } from '../common/types/response.types';

@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post('verify')
  async verifyCredentials(
    @Body() verifyDto: { service: string; username: string; password: string },
  ): Promise<ApiResponse<{ valid: boolean }>> {
    try {
      const { service, username, password } = verifyDto;
      const valid = await this.credentialsService.verifyCredentials(
        service,
        username,
        password,
      );
      
      return {
        status: 'success',
        data: { valid },
      };
    } catch (error) {
      throw new HttpException({
        status: 'error',
        message: 'Failed to verify credentials',
        details: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Additional endpoints for managing credentials would be implemented here
  // in a full implementation
} 