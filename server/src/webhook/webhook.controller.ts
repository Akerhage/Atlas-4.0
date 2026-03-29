import { Controller, Post, Body } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post('lhc-chat')
  handleLhcChat(@Body() body: unknown) {
    return this.webhookService.handleLhcChat(body);
  }
}
