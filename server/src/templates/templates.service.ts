import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.template.findMany({ orderBy: { name: 'asc' } });
  }

  async save(data: { id?: number; name?: string; subject?: string; body?: string; category?: string }) {
    if (data.id) {
      return this.prisma.template.update({
        where: { id: data.id },
        data: { name: data.name, subject: data.subject, body: data.body, category: data.category },
      });
    }
    return this.prisma.template.create({
      data: { name: data.name || '', subject: data.subject || '', body: data.body || '', category: data.category },
    });
  }

  async delete(id: number) {
    return this.prisma.template.delete({ where: { id } });
  }
}
