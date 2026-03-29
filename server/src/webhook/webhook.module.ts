import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [RagModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
