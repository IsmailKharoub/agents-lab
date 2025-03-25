import { Module, MiddlewareConsumer, RequestMethod, forwardRef } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { ApiKeyMiddleware } from '../common/middleware/api-key.middleware';
import { RateLimiterMiddleware } from '../common/middleware/rate-limiter.middleware';
import { DaemonModule } from '../daemon/daemon.module';

@Module({
  imports: [
    forwardRef(() => DaemonModule),
  ],
  controllers: [AgentsController]
})
export class AgentsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware, RateLimiterMiddleware)
      .forRoutes(
        { path: 'agents', method: RequestMethod.ALL },
        { path: 'agents/:id', method: RequestMethod.ALL }
      );
  }
} 