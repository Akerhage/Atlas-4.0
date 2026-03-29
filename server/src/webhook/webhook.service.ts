import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { RagService } from '../rag/rag.service';

const HUMAN_TRIGGERS = ['prata med människa', 'kundtjänst', 'jag vill ha personal', 'människa'];
const HUMAN_RESPONSE_TEXT = 'Jag kopplar dig till en mänsklig kollega.';

@Injectable()
export class WebhookService {
  private io: any = null;

  constructor(
    private config: ConfigService,
    private db: DatabaseService,
    private ragService: RagService,
  ) {}

  setSocketServer(io: any) {
    this.io = io;
  }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.config.get('LHC_WEBHOOK_SECRET');
    if (!secret || secret === 'temp_secret_12345') return false;

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async handleLhcChat(payload: { chat_id: string; id: number; msg: string; type: 'chat' | 'mail' }) {
    const { chat_id, id: incomingId, msg, type: ingestType } = payload;
    if (!chat_id || !msg) return { status: 'ignored' };

    const v2State = this.db.raw
      .prepare('SELECT * FROM chat_v2_state WHERE conversation_id = ?')
      .get(chat_id) as Record<string, unknown> | undefined;

    const contextRow = this.db.raw
      .prepare('SELECT * FROM context_store WHERE conversation_id = ?')
      .get(chat_id) as { context_data: string; last_message_id: number } | undefined;

    // Zombie revival
    if (ingestType === 'mail' && v2State && (v2State.is_archived as number) === 1) {
      this.db.raw.prepare("UPDATE chat_v2_state SET is_archived = 0, human_mode = 1, updated_at = strftime('%s','now') WHERE conversation_id = ?").run(chat_id);
      this.io?.emit('team:update', { type: 'ticket_revived', conversationId: chat_id });
    }

    // Idempotency
    if (contextRow && incomingId <= (contextRow.last_message_id || 0)) {
      return { status: 'duplicate' };
    }

    // Already in human mode — store and notify
    if (v2State && (v2State.human_mode as number) === 1) {
      this.storeMessage(chat_id, msg, incomingId, contextRow);
      this.io?.emit('team:customer_reply', { conversation_id: chat_id, message: msg });
      this.io?.emit('team:update', { type: 'new_message', conversationId: chat_id });
      return { status: 'human_mode' };
    }

    // Human trigger
    const lowerMsg = msg.toLowerCase();
    if (HUMAN_TRIGGERS.some(t => lowerMsg.includes(t))) {
      this.storeMessage(chat_id, msg, incomingId, contextRow);

      if (!v2State) {
        this.db.raw.prepare("INSERT OR IGNORE INTO chat_v2_state (conversation_id, human_mode, session_type, source, updated_at) VALUES (?, 1, 'customer', 'lhc', strftime('%s','now'))").run(chat_id);
      } else {
        this.db.raw.prepare("UPDATE chat_v2_state SET human_mode = 1, session_type = 'customer', updated_at = strftime('%s','now') WHERE conversation_id = ?").run(chat_id);
      }

      this.io?.emit('team:update', { type: 'human_mode_triggered', conversationId: chat_id });
      await this.sendToLhc(chat_id, HUMAN_RESPONSE_TEXT);
      return { status: 'escalated', response: HUMAN_RESPONSE_TEXT };
    }

    // RAG processing
    try {
      const contextData = contextRow ? JSON.parse(contextRow.context_data || '{}') : {};
      const result = await this.ragService.query({
        query: msg,
        sessionId: chat_id,
        session_type: 'customer',
        context: { locked_context: contextData.locked_context },
      });

      this.storeMessage(chat_id, msg, incomingId, contextRow);

      if (!v2State) {
        this.db.raw.prepare("INSERT OR IGNORE INTO chat_v2_state (conversation_id, human_mode, session_type, source, updated_at) VALUES (?, 0, 'bot', 'lhc', strftime('%s','now'))").run(chat_id);
      }

      await this.sendToLhc(chat_id, result.answer);
      this.io?.emit('team:update', { type: 'new_message', conversationId: chat_id });
      return { status: 'answered', response: result.answer };
    } catch (err) {
      console.error('Webhook RAG error:', err);
      return { status: 'error' };
    }
  }

  private storeMessage(conversationId: string, message: string, messageId: number, existing: { context_data: string; last_message_id: number } | undefined) {
    if (existing) {
      const data = JSON.parse(existing.context_data || '{}');
      const msgs = data.messages || [];
      msgs.push({ role: 'customer', content: message, timestamp: Date.now() });
      data.messages = msgs;
      this.db.raw.prepare('UPDATE context_store SET context_data = ?, last_message_id = ?, updated_at = strftime(\'%s\',\'now\') WHERE conversation_id = ?').run(JSON.stringify(data), messageId, conversationId);
    } else {
      this.db.raw.prepare('INSERT INTO context_store (conversation_id, context_data, last_message_id, updated_at) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))').run(
        conversationId, JSON.stringify({ messages: [{ role: 'customer', content: message, timestamp: Date.now() }] }), messageId,
      );
    }
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
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ msg: message }),
        });
        if (res.ok) return;
      } catch {
        if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
}
