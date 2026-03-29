import { Controller, Post, Body, Headers, Req, ForbiddenException, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post('lhc-chat')
  handleLhcChat(
    @Body() body: { chat_id: string; id: number; msg: string; type: 'chat' | 'mail' },
    @Headers('x-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // HMAC verification
    if (signature && req.rawBody) {
      const valid = this.webhookService.verifySignature(req.rawBody, signature);
      if (!valid) throw new ForbiddenException('Invalid signature');
    }

    return this.webhookService.handleLhcChat(body);
  }
}
