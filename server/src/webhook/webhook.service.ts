import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RagService } from '../rag/rag.service';

const HUMAN_TRIGGERS = ['prata med människa', 'kundtjänst', 'jag vill ha personal', 'människa'];
const HUMAN_RESPONSE_TEXT = 'Jag kopplar dig till en mänsklig kollega.';

@Injectable()
export class WebhookService {
  private io: any = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private ragService: RagService,
  ) {}

  setSocketServer(io: any) { this.io = io; }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.config.get('LHC_WEBHOOK_SECRET');
    if (!secret || secret === 'temp_secret_12345') return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
  }

  async handleLhcChat(payload: { chat_id: string; id: number; msg: string; type: 'chat' | 'mail' }) {
    const { chat_id, id: incomingId, msg, type: ingestType } = payload;
    if (!chat_id || !msg) return { status: 'ignored' };

    const ticket = await this.prisma.ticket.findUnique({ where: { id: chat_id } });

    // Zombie revival
    if (ingestType === 'mail' && ticket?.status === 'closed') {
      await this.prisma.ticket.update({ where: { id: chat_id }, data: { status: 'open', humanMode: true } });
      this.io?.emit('team:update', { type: 'ticket_revived', conversationId: chat_id });
    }

    // Idempotency
    if (ticket && incomingId <= ticket.lastMessageId) return { status: 'duplicate' };

    // Already in human mode
    if (ticket?.humanMode) {
      await this.storeMessage(chat_id, msg, incomingId);
      this.io?.emit('team:customer_reply', { conversation_id: chat_id, message: msg });
      this.io?.emit('team:update', { type: 'new_message', conversationId: chat_id });
      return { status: 'human_mode' };
    }

    // Human trigger
    const lowerMsg = msg.toLowerCase();
    if (HUMAN_TRIGGERS.some(t => lowerMsg.includes(t))) {
      await this.storeMessage(chat_id, msg, incomingId);
      await this.prisma.ticket.upsert({
        where: { id: chat_id },
        update: { humanMode: true, channel: 'chat', source: 'lhc' },
        create: { id: chat_id, humanMode: true, channel: 'chat', source: 'lhc' },
      });
      this.io?.emit('team:update', { type: 'human_mode_triggered', conversationId: chat_id });
      await this.sendToLhc(chat_id, HUMAN_RESPONSE_TEXT);
      return { status: 'escalated', response: HUMAN_RESPONSE_TEXT };
    }

    // RAG processing
    try {
      const result = await this.ragService.query({
        query: msg, sessionId: chat_id, session_type: 'customer', context: {},
      });

      await this.storeMessage(chat_id, msg, incomingId);
      await this.prisma.ticket.upsert({
        where: { id: chat_id },
        update: { lastMessage: msg, lastMessageId: incomingId },
        create: { id: chat_id, channel: 'chat', source: 'lhc', lastMessage: msg, lastMessageId: incomingId },
      });

      await this.sendToLhc(chat_id, result.answer);
      this.io?.emit('team:update', { type: 'new_message', conversationId: chat_id });
      return { status: 'answered', response: result.answer };
    } catch (err) {
      console.error('Webhook RAG error:', err);
      return { status: 'error' };
    }
  }

  private async storeMessage(ticketId: string, message: string, messageId: number) {
    // Ensure ticket exists
    await this.prisma.ticket.upsert({
      where: { id: ticketId },
      update: { lastMessage: message, lastMessageId: messageId },
      create: { id: ticketId, channel: 'chat', lastMessage: message, lastMessageId: messageId },
    });
    await this.prisma.message.create({
      data: { ticketId, role: 'customer', content: message },
    });
  }

  private async sendToLhc(chatId: string, message: string, retries = 3) {
    const apiUrl = this.config.get('LHC_API_URL');
    const apiUser = this.config.get('LHC_API_USER');
    const apiKey = this.config.get('LHC_API_KEY');
    if (!apiUrl) return;
    const url = `${apiUrl}/restapi/v2/chat/sendmessage/${chatId}`;
    const auth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ msg: message }),
        });
        if (res.ok) return;
      } catch { if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt)); }
    }
  }
}
