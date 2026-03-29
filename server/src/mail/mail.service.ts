import { Injectable } from '@nestjs/common';

/**
 * Mail Service — handles IMAP listening and Nodemailer sending.
 * TODO: Port the IMAP listener and email sending from server.js.
 */
@Injectable()
export class MailService {
  async sendMail(to: string, subject: string, body: string) {
    // TODO: Port Nodemailer transport configuration
    console.log(`📧 Mail service: send to ${to} (not yet ported)`);
  }

  async startImapListener() {
    // TODO: Port IMAP listener from server.js checkEmailReplies()
    console.log('📬 IMAP listener: not yet ported');
  }
}
