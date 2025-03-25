import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException({
        status: 'error',
        code: 401,
        message: 'Invalid or missing API key',
      });
    }

    // In a production environment, you would validate the API key against a database or service
    // Here we're accepting any non-empty key as this is just for development
    
    // Store API key in request object for later use
    req['apiKey'] = apiKey;
    
    next();
  }
} 