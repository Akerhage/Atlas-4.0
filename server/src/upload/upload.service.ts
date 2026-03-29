import { Injectable, OnModuleInit } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UploadService implements OnModuleInit {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.runCleanup();
    this.cleanupInterval = setInterval(() => this.runCleanup(), 24 * 60 * 60 * 1000);
  }

  async registerUpload(opts: { conversationId: string; filename: string; originalName: string; filepath: string; ttlDays?: number }) {
    const ttlDays = opts.ttlDays || 90;
    const nowSeconds = Math.floor(Date.now() / 1000);
    await this.prisma.uploadedFile.create({
      data: {
        ticketId: opts.conversationId === 'unknown' ? null : opts.conversationId,
        filename: opts.filename,
        originalName: opts.originalName,
        filepath: opts.filepath,
        expiresAt: nowSeconds + (ttlDays * 86400),
      },
    });
  }

  async patchConversation(filename: string, conversationId: string, ttlDays = 365) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    await this.prisma.uploadedFile.updateMany({
      where: { filename },
      data: { ticketId: conversationId, expiresAt: nowSeconds + (ttlDays * 86400) },
    });
  }

  private async runCleanup() {
    try {
      const now = Math.floor(Date.now() / 1000);
      const expired = await this.prisma.uploadedFile.findMany({
        where: { deleted: false, expiresAt: { lte: now } },
      });
      for (const file of expired) {
        if (existsSync(file.filepath)) { try { unlinkSync(file.filepath); } catch { /* */ } }
        await this.prisma.uploadedFile.update({ where: { id: file.id }, data: { deleted: true } });
      }
      if (expired.length > 0) console.log(`🗑️ Cleaned ${expired.length} expired uploads`);
    } catch (err) {
      console.error('Upload cleanup error:', err);
    }
  }
}
