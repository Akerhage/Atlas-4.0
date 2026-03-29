import { Injectable, OnModuleInit } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UploadService implements OnModuleInit {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private db: DatabaseService) {}

  onModuleInit() {
    // Run cleanup on startup and every 24h
    this.runCleanup();
    this.cleanupInterval = setInterval(() => this.runCleanup(), 24 * 60 * 60 * 1000);
    console.log('🗑️ Upload cleanup scheduled (every 24h)');
  }

  registerUpload(opts: {
    conversationId: string;
    filename: string;
    originalName: string;
    filepath: string;
    ttlDays?: number;
  }) {
    const ttlDays = opts.ttlDays || 90;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = nowSeconds + (ttlDays * 86400);

    this.db.raw.prepare(`
      INSERT INTO uploaded_files (conversation_id, filename, original_name, filepath, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(opts.conversationId, opts.filename, opts.originalName, opts.filepath, expiresAt);
  }

  patchConversation(filename: string, conversationId: string, ttlDays = 365) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = nowSeconds + (ttlDays * 86400);
    this.db.raw.prepare(`
      UPDATE uploaded_files SET conversation_id = ?, expires_at = ? WHERE filename = ?
    `).run(conversationId, expiresAt, filename);
  }

  private runCleanup() {
    try {
      const now = Math.floor(Date.now() / 1000);
      const expired = this.db.raw.prepare(
        'SELECT id, filepath FROM uploaded_files WHERE deleted = 0 AND expires_at <= ?',
      ).all(now) as Array<{ id: number; filepath: string }>;

      for (const file of expired) {
        if (existsSync(file.filepath)) {
          try { unlinkSync(file.filepath); } catch { /* ignore */ }
        }
        this.db.raw.prepare('UPDATE uploaded_files SET deleted = 1 WHERE id = ?').run(file.id);
      }

      if (expired.length > 0) {
        console.log(`🗑️ Cleaned up ${expired.length} expired uploads`);
      }
    } catch (err) {
      console.error('Upload cleanup error:', err);
    }
  }
}
