import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import { v4 as uuid } from 'uuid';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private transporter!: nodemailer.Transporter;
  private imapInterval: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private emailBlocklist: Array<{ pattern: string; type: string }> = [];
  private io: any = null; // Socket.IO server reference (injected later)

  constructor(
    private config: ConfigService,
    private db: DatabaseService,
  ) {}

  onModuleInit() {
    this.createTransporter();
    this.loadBlocklist();

    // Start IMAP polling if configured
    const imapUser = this.config.get('IMAP_USER') || this.config.get('EMAIL_USER');
    const imapPass = this.config.get('IMAP_PASS') || this.config.get('EMAIL_PASS');
    if (imapUser && imapPass) {
      this.imapInterval = setInterval(() => this.checkEmailReplies(), 15_000);
      console.log('📬 IMAP listener started (every 15s)');
    }
  }

  onModuleDestroy() {
    if (this.imapInterval) clearInterval(this.imapInterval);
  }

  setSocketServer(io: any) {
    this.io = io;
  }

  private createTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST') || 'smtp-relay.brevo.com',
      port: Number(this.config.get('SMTP_PORT')) || 587,
      secure: false,
      auth: {
        user: this.config.get('EMAIL_USER'),
        pass: this.config.get('EMAIL_PASS'),
      },
    });
    console.log('📧 Mail transporter created');
  }

  recreateTransporter() {
    this.createTransporter();
    console.log('✅ Mail transporter recreated (hot-reload)');
  }

  private loadBlocklist() {
    try {
      this.emailBlocklist = this.db.raw
        .prepare('SELECT pattern, type FROM email_blocklist')
        .all() as Array<{ pattern: string; type: string }>;
      console.log(`✅ Email blocklist loaded: ${this.emailBlocklist.length} rules`);
    } catch {
      this.emailBlocklist = [];
    }
  }

  reloadBlocklist() {
    this.loadBlocklist();
  }

  // --- Send Email ---
  async sendReply(opts: {
    to: string;
    subject: string;
    body: string;
    conversationId: string;
    inReplyTo?: string;
    references?: string[];
  }) {
    const fromName = this.config.get('EMAIL_FROM_NAME') || 'My Driving Academy Support';
    const fromEmail = this.config.get('EMAIL_FROM') || this.config.get('EMAIL_USER');
    const replyTo = this.config.get('IMAP_USER') || this.config.get('EMAIL_USER');

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      replyTo,
      to: opts.to,
      subject: opts.subject.includes('[Ärende:')
        ? opts.subject
        : `Re: ${opts.subject} [Ärende: ${opts.conversationId}]`,
      html: opts.body,
      headers: {
        'X-Atlas-Ticket-ID': opts.conversationId,
      },
    };

    if (opts.inReplyTo) {
      mailOptions.inReplyTo = opts.inReplyTo;
    }
    if (opts.references?.length) {
      mailOptions.references = opts.references.join(' ');
    }

    const sentInfo = await this.transporter.sendMail(mailOptions);
    return { messageId: sentInfo.messageId };
  }

  async sendNewMail(opts: {
    to: string;
    subject: string;
    body: string;
    agent: string;
  }) {
    const conversationId = `session_mail_${Date.now()}_${uuid().substring(0, 6)}`;
    const fromName = this.config.get('EMAIL_FROM_NAME') || 'My Driving Academy Support';
    const fromEmail = this.config.get('EMAIL_FROM') || this.config.get('EMAIL_USER');

    const sentInfo = await this.transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: `${opts.subject} [Ärende: ${conversationId}]`,
      html: opts.body,
      headers: { 'X-Atlas-Ticket-ID': conversationId },
    });

    // Create ticket in database
    this.db.raw.prepare(`
      INSERT OR IGNORE INTO context_store (conversation_id, context_data, last_message_id, updated_at)
      VALUES (?, ?, 1, strftime('%s','now'))
    `).run(conversationId, JSON.stringify({
      messages: [{ role: 'agent', content: opts.body, isEmail: true, messageId: sentInfo.messageId, timestamp: Date.now() }],
      locked_context: { email: opts.to, subject: opts.subject },
    }));

    this.db.raw.prepare(`
      INSERT OR IGNORE INTO chat_v2_state (conversation_id, human_mode, owner, session_type, source, email, updated_at)
      VALUES (?, 1, ?, 'message', 'agent', ?, strftime('%s','now'))
    `).run(conversationId, opts.agent, opts.to);

    return { conversationId, messageId: sentInfo.messageId };
  }

  // --- IMAP Listener ---
  private async checkEmailReplies() {
    if (this.isScanning) return;
    this.isScanning = true;

    const imapUser = this.config.get('IMAP_USER') || this.config.get('EMAIL_USER');
    const imapPass = this.config.get('IMAP_PASS') || this.config.get('EMAIL_PASS');

    if (!imapUser || !imapPass) {
      this.isScanning = false;
      return;
    }

    try {
      const connection = await imapSimple.connect({
        imap: {
          user: imapUser,
          password: imapPass,
          host: 'imap.gmail.com',
          port: 993,
          tls: true,
          authTimeout: 30000,
          connTimeout: 30000,
          tlsOptions: { rejectUnauthorized: false },
        },
      });

      await connection.openBox('INBOX');
      const messages = await connection.search(['UNSEEN'], {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false,
      });

      for (const msg of messages) {
        try {
          await this.processInboundEmail(msg, connection);
        } catch (err) {
          console.error('IMAP message processing error:', err);
        }
      }

      connection.end();
    } catch (err) {
      console.error('IMAP connection error:', err);
    } finally {
      this.isScanning = false;
    }
  }

  private async processInboundEmail(msg: any, connection: any) {
    const headerPart = msg.parts.find((p: any) => p.which === 'HEADER');
    const fullBodyPart = msg.parts.find((p: any) => p.which === '');

    if (!headerPart || !fullBodyPart) return;

    const headers = headerPart.body;
    const from = Array.isArray(headers.from) ? headers.from[0] : headers.from;
    const subject = Array.isArray(headers.subject) ? headers.subject[0] : (headers.subject || '');

    // Echo filter: ignore own emails
    const ownEmail = this.config.get('EMAIL_USER') || '';
    if (from?.toLowerCase().includes(ownEmail.toLowerCase())) return;

    // Blocklist filter
    const fromLower = (from || '').toLowerCase();
    if (this.emailBlocklist.some(b => fromLower.includes(b.pattern.toLowerCase()))) return;

    // Parse email content
    const parsed = await simpleParser(fullBodyPart.body);
    const textContent = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ').trim() || '';

    // Clean quoted text
    let cleanContent = textContent;
    const quoteSplitters = ['On ', '-----Original Message', 'Från:', 'From:'];
    for (const splitter of quoteSplitters) {
      const idx = cleanContent.indexOf(splitter);
      if (idx > 0) cleanContent = cleanContent.substring(0, idx).trim();
    }

    // Extract ticket ID from subject
    const ticketMatch = subject.match(/\[Ärende:\s*([^\]]+)\]/);
    let conversationId = ticketMatch?.[1]?.trim();

    // Fallback: check X-Atlas-Ticket-ID header
    if (!conversationId) {
      const customHeader = headers['x-atlas-ticket-id'];
      conversationId = Array.isArray(customHeader) ? customHeader[0] : customHeader;
    }

    // Extract sender info
    const senderMatch = from?.match(/"?([^"<]*)"?\s*<?([^>]*)>?/);
    const senderName = senderMatch?.[1]?.trim() || '';
    const senderEmail = senderMatch?.[2]?.trim() || from || '';

    if (conversationId) {
      // Reply to existing ticket
      await this.appendToTicket(conversationId, cleanContent, senderName, senderEmail, parsed.messageId);
    } else {
      // Check if inbound mail creation is enabled
      const imapInbound = this.db.raw
        .prepare("SELECT value FROM settings WHERE key = 'imap_inbound'")
        .get() as { value: string } | undefined;

      if (imapInbound?.value === 'true') {
        conversationId = `MAIL_INBOUND_${uuid()}`;
        await this.createInboundTicket(conversationId, subject, cleanContent, senderName, senderEmail);
      }
    }

    // Mark as seen
    try {
      await connection.addFlags(msg.attributes.uid, ['\\Seen']);
    } catch { /* ignore */ }
  }

  private async appendToTicket(conversationId: string, content: string, name: string, email: string, messageId?: string) {
    const existing = this.db.raw
      .prepare('SELECT context_data, last_message_id FROM context_store WHERE conversation_id = ?')
      .get(conversationId) as { context_data: string; last_message_id: number } | undefined;

    if (!existing) return;

    const contextData = JSON.parse(existing.context_data || '{}');
    const messages = contextData.messages || [];
    messages.push({
      role: 'customer',
      content,
      timestamp: Date.now(),
      isEmail: true,
      messageId: messageId || undefined,
    });
    contextData.messages = messages;

    const newId = (existing.last_message_id || 0) + 1;
    this.db.raw.prepare(`
      UPDATE context_store SET context_data = ?, last_message_id = ?, updated_at = strftime('%s','now')
      WHERE conversation_id = ?
    `).run(JSON.stringify(contextData), newId, conversationId);

    // Reactivate if archived
    this.db.raw.prepare(`
      UPDATE chat_v2_state SET human_mode = 1, is_archived = 0, updated_at = strftime('%s','now')
      WHERE conversation_id = ?
    `).run(conversationId);

    // Emit socket events
    if (this.io) {
      this.io.emit('team:customer_reply', { conversation_id: conversationId, message: content });
      this.io.emit('team:update', { type: 'new_message', conversationId });
    }
  }

  private async createInboundTicket(conversationId: string, subject: string, content: string, name: string, email: string) {
    this.db.raw.prepare(`
      INSERT OR IGNORE INTO context_store (conversation_id, context_data, last_message_id, updated_at)
      VALUES (?, ?, 1, strftime('%s','now'))
    `).run(conversationId, JSON.stringify({
      messages: [{ role: 'customer', content, timestamp: Date.now(), isEmail: true }],
      locked_context: { name, email, subject },
    }));

    this.db.raw.prepare(`
      INSERT OR IGNORE INTO chat_v2_state (conversation_id, human_mode, session_type, source, email, name, updated_at)
      VALUES (?, 1, 'message', 'inbound', ?, ?, strftime('%s','now'))
    `).run(conversationId, email, name);

    if (this.io) {
      this.io.emit('team:new_ticket', { conversationId, channel: 'mail' });
      this.io.emit('team:update', { type: 'new_ticket', conversationId });
    }
  }
}
