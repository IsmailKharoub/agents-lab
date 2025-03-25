import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PresetPromptsController } from './preset-prompts.controller';
import { PresetPromptsService } from './preset-prompts.service';
import { PresetPrompt, PresetPromptSchema } from './schemas/preset-prompt.schema';
import { ApiKeyMiddleware } from '../common/middleware/api-key.middleware';
import { RateLimiterMiddleware } from '../common/middleware/rate-limiter.middleware';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PresetPrompt.name, schema: PresetPromptSchema },
    ]),
  ],
  controllers: [PresetPromptsController],
  providers: [PresetPromptsService],
  exports: [PresetPromptsService],
})
export class PresetPromptsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware, RateLimiterMiddleware)
      .forRoutes(
        { path: 'preset-prompts', method: RequestMethod.ALL },
        { path: 'preset-prompts/:id', method: RequestMethod.ALL }
      );
  }
} 