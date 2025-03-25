import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    
    // Log request start
    this.logger.log(`[REQUEST] ${method} ${originalUrl} - ${ip} - ${userAgent}`);
    
    // Log request body if present
    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
      this.logger.debug(`[REQUEST BODY] ${JSON.stringify(req.body, null, 2)}`);
    }
    
    // Log request headers (excluding auth/sensitive data)
    const safeHeaders = { ...headers };
    ['authorization', 'cookie', 'x-api-key'].forEach(key => {
      if (safeHeaders[key]) {
        safeHeaders[key] = '[REDACTED]';
      }
    });
    this.logger.debug(`[REQUEST HEADERS] ${JSON.stringify(safeHeaders, null, 2)}`);
    
    // Log response when completed
    const originalSend = res.send;
    res.send = function (body) {
      const responseBody = body instanceof Buffer ? '[Buffer]' : body;
      
      // Log response
      if (typeof responseBody === 'string' && responseBody.length < 1000) {
        try {
          // Try to parse JSON for prettier logging if it's JSON
          const jsonBody = JSON.parse(responseBody);
          this.logger.debug(`[RESPONSE] ${res.statusCode} - ${JSON.stringify(jsonBody, null, 2)}`);
        } catch {
          // If not JSON, log as is (truncated if very long)
          this.logger.debug(`[RESPONSE] ${res.statusCode} - ${responseBody.substring(0, 500)}${responseBody.length > 500 ? '...(truncated)' : ''}`);
        }
      } else {
        this.logger.debug(`[RESPONSE] ${res.statusCode} - [Response body too large or non-string]`);
      }
      
      originalSend.apply(res, arguments);
      return res;
    }.bind(this);
    
    // Track response time
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      this.logger.log(`[RESPONSE] ${method} ${originalUrl} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  }
} 