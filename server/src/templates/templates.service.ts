import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Template } from '../shared/types';

@Injectable()
export class TemplatesService {
  constructor(private db: DatabaseService) {}

  getAll(): Template[] {
    return this.db.getAllTemplates();
  }

  save(data: Partial<Template>) {
    return this.db.saveTemplate(data);
  }

  delete(id: number) {
    return this.db.deleteTemplate(id);
  }
}
