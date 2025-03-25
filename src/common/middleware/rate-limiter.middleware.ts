import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { RateLimiterMemory } from 'rate-limiter-flexible';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private rateLimiter: RateLimiterMemory;

  constructor(private readonly configService: ConfigService) {
    const maxRequests = this.configService.get<number>('RATE_LIMIT_MAX') || 100;
    const windowSec = this.configService.get<number>('RATE_LIMIT_WINDOW') || 60;

    this.rateLimiter = new RateLimiterMemory({
      points: maxRequests, // Number of requests
      duration: windowSec, // Per second
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Use API key or IP address as key
    const key = req['apiKey'] || req.ip;

    try {
      const rateLimiterRes = await this.rateLimiter.consume(key);
      
      // Add rate limit headers
      res.setHeader('X-Rate-Limit-Limit', this.rateLimiter.points);
      res.setHeader('X-Rate-Limit-Remaining', rateLimiterRes.remainingPoints);
      res.setHeader('X-Rate-Limit-Reset', Math.round(rateLimiterRes.msBeforeNext / 1000));
      
      next();
    } catch (err) {
      const retryAfter = Math.round(err.msBeforeNext / 1000);
      
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-Rate-Limit-Limit', this.rateLimiter.points);
      res.setHeader('X-Rate-Limit-Remaining', 0);
      res.setHeader('X-Rate-Limit-Reset', retryAfter);
      
      throw new HttpException({
        status: 'error',
        code: 429,
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
} 