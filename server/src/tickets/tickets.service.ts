import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Ticket } from '../shared/types';

@Injectable()
export class TicketsService {
  constructor(private db: DatabaseService) {}

  getInbox(): Ticket[] {
    return this.db.getTeamInbox();
  }

  getTicket(conversationId: string) {
    return this.db.getTicketById(conversationId);
  }

  getMessages(conversationId: string) {
    // Messages are stored in context_store.messages as JSON
    const row = this.db.raw
      .prepare('SELECT messages FROM context_store WHERE conversation_id = ?')
      .get(conversationId) as { messages?: string } | undefined;

    if (!row?.messages) return [];

    try {
      return JSON.parse(row.messages);
    } catch {
      return [];
    }
  }

  claimTicket(conversationId: string, agent: string) {
    const ticket = this.db.getTicketById(conversationId);
    const previousOwner = ticket?.owner;
    this.db.claimTicket(conversationId, agent);
    return { success: true, previousOwner };
  }

  assignTicket(conversationId: string, targetAgent: string) {
    this.db.assignTicket(conversationId, targetAgent);
    return { success: true };
  }

  archiveTicket(conversationId: string) {
    this.db.archiveTicket(conversationId);
    return { success: true };
  }

  deleteTicket(conversationId: string) {
    this.db.deleteConversation(conversationId);
    return { success: true };
  }

  restoreTicket(conversationId: string) {
    this.db.raw
      .prepare("UPDATE chat_v2_state SET status = 'open', owner = NULL, archived_at = NULL WHERE conversation_id = ?")
      .run(conversationId);
    return { success: true };
  }

  searchInbox(query: string) {
    return this.db.raw
      .prepare(`
        SELECT cs.conversation_id, cs.last_message, cs.updated_at,
               v2.session_type as channel, v2.owner, v2.routing_tag, v2.status,
               v2.customer_name, v2.customer_email
        FROM context_store cs
        JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
        WHERE v2.status IN ('open', 'claimed')
          AND (cs.last_message LIKE ? OR v2.customer_name LIKE ? OR v2.customer_email LIKE ?)
        ORDER BY cs.updated_at DESC
      `)
      .all(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  getArchive(search?: string, limit?: number, offset?: number) {
    return this.db.getArchivedTickets(search, limit, offset);
  }
}
