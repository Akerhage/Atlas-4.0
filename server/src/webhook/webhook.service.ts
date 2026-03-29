import { Injectable } from '@nestjs/common';

/**
 * Webhook Service — handles incoming webhooks from LiveHelperChat.
 * TODO: Port webhook/lhc-chat logic from routes/webhook.js.
 */
@Injectable()
export class WebhookService {
  handleLhcChat(data: unknown) {
    // TODO: Port LiveHelperChat webhook processing
    console.log('📨 Webhook received (not yet ported):', data);
    return { success: true };
  }
}
