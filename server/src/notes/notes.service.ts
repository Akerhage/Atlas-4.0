import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotesService {
  constructor(private db: DatabaseService) {}

  getForTicket(conversationId: string) {
    return this.db.getTicketNotes(conversationId);
  }

  add(conversationId: string, agentName: string, content: string) {
    return this.db.addTicketNote(conversationId, agentName, content);
  }

  update(id: number, content: string) {
    return this.db.updateTicketNote(id, content);
  }

  delete(id: number) {
    return this.db.deleteTicketNote(id);
  }
}
