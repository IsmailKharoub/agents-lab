import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { Credential, CredentialSchema } from './schemas/credential.schema';
import { ApiKeyMiddleware } from '../common/middleware/api-key.middleware';
import { RateLimiterMiddleware } from '../common/middleware/rate-limiter.middleware';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Credential.name, schema: CredentialSchema },
    ]),
  ],
  controllers: [CredentialsController],
  providers: [CredentialsService],
  exports: [CredentialsService],
})
export class CredentialsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware, RateLimiterMiddleware)
      .forRoutes({ path: 'credentials*', method: RequestMethod.ALL });
  }
} 