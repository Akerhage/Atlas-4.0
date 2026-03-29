import { Injectable } from '@nestjs/common';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class KnowledgeService {
  private knowledgePath = join(__dirname, '..', '..', '..', 'knowledge');

  getByTag(routingTag: string) {
    const filePath = join(this.knowledgePath, `${routingTag}.json`);
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  updateByTag(routingTag: string, data: unknown) {
    const filePath = join(this.knowledgePath, `${routingTag}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  }

  getBasfaktaList() {
    if (!existsSync(this.knowledgePath)) return [];
    return readdirSync(this.knowledgePath)
      .filter(f => f.startsWith('basfakta_') && f.endsWith('.json'))
      .map(filename => {
        try {
          const content = JSON.parse(readFileSync(join(this.knowledgePath, filename), 'utf-8'));
          return { filename, title: content.title || filename.replace('.json', '').replace('basfakta_', '') };
        } catch {
          return { filename, title: filename.replace('.json', '') };
        }
      });
  }

  getBasfaktaFile(filename: string) {
    const filePath = join(this.knowledgePath, filename);
    if (!existsSync(filePath)) return { sections: [] };
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return { sections: [] };
    }
  }

  saveBasfaktaFile(filename: string, data: unknown) {
    const filePath = join(this.knowledgePath, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  }
}
