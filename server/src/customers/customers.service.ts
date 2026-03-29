import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CustomersService {
  constructor(private db: DatabaseService) {}

  getAll(search?: string, page = 1, limit = 50) {
    let whereClause = "WHERE v2.customer_email IS NOT NULL AND v2.customer_email != ''";
    const params: unknown[] = [];

    if (search) {
      whereClause += ' AND (v2.customer_name LIKE ? OR v2.customer_email LIKE ? OR v2.customer_phone LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const total = this.db.raw.prepare(`
      SELECT COUNT(DISTINCT v2.customer_email) as count
      FROM chat_v2_state v2 ${whereClause}
    `).get(...params) as { count: number };

    const customers = this.db.raw.prepare(`
      SELECT v2.customer_name as name, v2.customer_email as email, v2.customer_phone as phone,
             v2.conversation_id, MAX(cs.updated_at) as last_activity,
             COUNT(v2.conversation_id) as ticket_count
      FROM chat_v2_state v2
      JOIN context_store cs ON v2.conversation_id = cs.conversation_id
      ${whereClause}
      GROUP BY v2.customer_email
      ORDER BY last_activity DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, (page - 1) * limit);

    return { customers, total: total.count };
  }

  getHistory(conversationId: string) {
    return this.db.raw.prepare(`
      SELECT cs.messages, cs.last_message, cs.updated_at,
             v2.customer_name, v2.customer_email, v2.session_type as channel
      FROM context_store cs
      JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
      WHERE cs.conversation_id = ?
    `).get(conversationId);
  }
}
