import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { join } from 'path';
import type { User, Office, Ticket, Template, TicketNote } from '../shared/types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db!: Database.Database;

  onModuleInit() {
    const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', '..', 'atlas.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    console.log(`📂 Database connected: ${dbPath}`);
  }

  onModuleDestroy() {
    this.db?.close();
  }

  get raw(): Database.Database {
    return this.db;
  }

  // --- Users ---
  getUserByUsername(username: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  }

  getAllUsers(): User[] {
    return this.db.prepare('SELECT id, username, display_name, role, agent_color, avatar_id, status_text, offices, allowed_views FROM users').all() as User[];
  }

  createUser(data: Partial<User> & { password_hash: string }): Database.RunResult {
    return this.db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role, agent_color, avatar_id, offices, allowed_views) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(data.username, data.password_hash, data.display_name || data.username, data.role || 'agent', data.agent_color || '#0071e3', data.avatar_id || 0, data.offices || '', data.allowed_views || null);
  }

  updateUser(id: number, data: Record<string, unknown>): Database.RunResult {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    return this.db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...values, id);
  }

  deleteUser(id: number): Database.RunResult {
    return this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  updateUserPassword(username: string, passwordHash: string): Database.RunResult {
    return this.db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, username);
  }

  // --- Offices ---
  getAllOffices(): Office[] {
    return this.db.prepare('SELECT * FROM offices ORDER BY city, area').all() as Office[];
  }

  getOfficeByTag(tag: string): Office | undefined {
    return this.db.prepare('SELECT * FROM offices WHERE routing_tag = ?').get(tag) as Office | undefined;
  }

  createOffice(data: Partial<Office>): Database.RunResult {
    return this.db.prepare(
      'INSERT INTO offices (name, routing_tag, city, area, office_color, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(data.name, data.routing_tag, data.city, data.area, data.office_color || '#0071e3', data.phone || '', data.email || '');
  }

  deleteOffice(tag: string): Database.RunResult {
    return this.db.prepare('DELETE FROM offices WHERE routing_tag = ?').run(tag);
  }

  // --- Tickets (context_store + chat_v2_state) ---
  getTeamInbox(): Ticket[] {
    return this.db.prepare(`
      SELECT cs.conversation_id, cs.last_message, cs.last_message_time, cs.created_at, cs.updated_at,
             v2.session_type as channel, v2.owner, v2.routing_tag, v2.status,
             v2.customer_name, v2.customer_email, v2.customer_phone, v2.human_mode
      FROM context_store cs
      JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
      WHERE v2.status IN ('open', 'claimed')
      ORDER BY cs.updated_at DESC
    `).all() as Ticket[];
  }

  getTicketById(conversationId: string): Ticket | undefined {
    return this.db.prepare(`
      SELECT cs.*, v2.session_type as channel, v2.owner, v2.routing_tag, v2.status,
             v2.customer_name, v2.customer_email, v2.customer_phone, v2.human_mode
      FROM context_store cs
      JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
      WHERE cs.conversation_id = ?
    `).get(conversationId) as Ticket | undefined;
  }

  claimTicket(conversationId: string, agent: string): Database.RunResult {
    return this.db.prepare(
      "UPDATE chat_v2_state SET owner = ?, status = 'claimed' WHERE conversation_id = ?",
    ).run(agent, conversationId);
  }

  assignTicket(conversationId: string, agent: string): Database.RunResult {
    return this.db.prepare(
      "UPDATE chat_v2_state SET owner = ?, status = 'claimed' WHERE conversation_id = ?",
    ).run(agent, conversationId);
  }

  archiveTicket(conversationId: string): Database.RunResult {
    return this.db.prepare(
      "UPDATE chat_v2_state SET status = 'closed', archived_at = datetime('now') WHERE conversation_id = ?",
    ).run(conversationId);
  }

  deleteConversation(conversationId: string): void {
    this.db.prepare('DELETE FROM context_store WHERE conversation_id = ?').run(conversationId);
    this.db.prepare('DELETE FROM chat_v2_state WHERE conversation_id = ?').run(conversationId);
  }

  getArchivedTickets(search?: string, limit = 50, offset = 0): { items: Ticket[]; total: number } {
    let whereClause = "WHERE v2.status = 'closed'";
    const params: unknown[] = [];

    if (search) {
      whereClause += ' AND (cs.last_message LIKE ? OR v2.customer_name LIKE ? OR v2.customer_email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const total = this.db.prepare(`
      SELECT COUNT(*) as count FROM context_store cs
      JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
      ${whereClause}
    `).get(...params) as { count: number };

    const items = this.db.prepare(`
      SELECT cs.conversation_id, cs.last_message, cs.last_message_time, cs.created_at, cs.updated_at,
             v2.session_type as channel, v2.owner, v2.routing_tag, v2.status,
             v2.customer_name, v2.customer_email, v2.customer_phone
      FROM context_store cs
      JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
      ${whereClause}
      ORDER BY cs.updated_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Ticket[];

    return { items, total: total.count };
  }

  // --- Templates ---
  getAllTemplates(): Template[] {
    return this.db.prepare('SELECT * FROM templates ORDER BY name').all() as Template[];
  }

  saveTemplate(data: Partial<Template>): Database.RunResult {
    if (data.id) {
      return this.db.prepare(
        'UPDATE templates SET name = ?, subject = ?, body = ?, category = ? WHERE id = ?',
      ).run(data.name, data.subject, data.body, data.category || null, data.id);
    }
    return this.db.prepare(
      'INSERT INTO templates (name, subject, body, category) VALUES (?, ?, ?, ?)',
    ).run(data.name, data.subject, data.body, data.category || null);
  }

  deleteTemplate(id: number): Database.RunResult {
    return this.db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  }

  // --- Notes ---
  getTicketNotes(conversationId: string): TicketNote[] {
    return this.db.prepare('SELECT * FROM ticket_notes WHERE conversation_id = ? ORDER BY created_at DESC').all(conversationId) as TicketNote[];
  }

  addTicketNote(conversationId: string, agentName: string, content: string): Database.RunResult {
    return this.db.prepare(
      "INSERT INTO ticket_notes (conversation_id, agent_name, content, created_at) VALUES (?, ?, ?, datetime('now'))",
    ).run(conversationId, agentName, content);
  }

  updateTicketNote(id: number, content: string): Database.RunResult {
    return this.db.prepare('UPDATE ticket_notes SET content = ? WHERE id = ?').run(content, id);
  }

  deleteTicketNote(id: number): Database.RunResult {
    return this.db.prepare('DELETE FROM ticket_notes WHERE id = ?').run(id);
  }
}
