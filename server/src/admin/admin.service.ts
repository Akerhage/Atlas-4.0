import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import type { User, Office } from '../shared/types';

@Injectable()
export class AdminService {
  constructor(private db: DatabaseService) {}

  // --- Users ---
  getAllUsers() {
    return this.db.getAllUsers();
  }

  async createUser(data: { username: string; password: string; display_name?: string; role?: string; agent_color?: string; avatar_id?: number; offices?: string; allowed_views?: string }) {
    const hash = await bcrypt.hash(data.password, 12);
    const { password, ...rest } = data;
    return this.db.createUser({ ...rest, role: (rest.role as 'admin' | 'agent') || 'agent', password_hash: hash });
  }

  async updateUserProfile(userId: number, data: Record<string, unknown>) {
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password as string, 12);
      delete data.password;
    }
    delete data.userId;
    return this.db.updateUser(userId, data);
  }

  async resetPassword(userId: number, password: string) {
    const hash = await bcrypt.hash(password, 12);
    return this.db.raw.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  }

  deleteUser(userId: number) {
    return this.db.deleteUser(userId);
  }

  getUserStats(username: string) {
    const stats = this.db.raw.prepare(`
      SELECT
        COUNT(CASE WHEN v2.status IN ('open','claimed') THEN 1 END) as active_tickets,
        COUNT(CASE WHEN v2.status = 'closed' THEN 1 END) as archived_tickets,
        COUNT(CASE WHEN v2.session_type = 'message' AND v2.status = 'closed' THEN 1 END) as mail_handled,
        COUNT(CASE WHEN v2.session_type = 'private' THEN 1 END) as internal_sent
      FROM chat_v2_state v2
      WHERE v2.owner = ?
    `).get(username);
    return stats || { active_tickets: 0, archived_tickets: 0, mail_handled: 0, internal_sent: 0 };
  }

  getAgentTickets(username: string) {
    return this.db.raw.prepare(`
      SELECT cs.conversation_id, cs.last_message, cs.updated_at,
             v2.session_type as channel, v2.owner, v2.routing_tag, v2.status,
             v2.customer_name, v2.customer_email
      FROM context_store cs
      JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
      WHERE v2.owner = ? AND v2.status IN ('open', 'claimed')
      ORDER BY cs.updated_at DESC
    `).all(username);
  }

  updateAgentColor(username: string, color: string) {
    return this.db.raw.prepare('UPDATE users SET agent_color = ? WHERE username = ?').run(color, username);
  }

  updateAgentOffices(username: string, offices: string) {
    return this.db.raw.prepare('UPDATE users SET offices = ? WHERE username = ?').run(offices, username);
  }

  updateUserViews(username: string, allowedViews: string | null) {
    return this.db.raw.prepare('UPDATE users SET allowed_views = ? WHERE username = ?').run(allowedViews, username);
  }

  // --- Offices ---
  getAllOffices() {
    return this.db.getAllOffices();
  }

  createOffice(data: Partial<Office>) {
    return this.db.createOffice(data);
  }

  deleteOffice(tag: string) {
    return this.db.deleteOffice(tag);
  }

  updateOfficeColor(routingTag: string, color: string) {
    return this.db.raw.prepare('UPDATE offices SET office_color = ? WHERE routing_tag = ?').run(color, routingTag);
  }

  getOfficeTickets(tag: string) {
    return this.db.raw.prepare(`
      SELECT cs.conversation_id, cs.last_message, cs.updated_at,
             v2.session_type as channel, v2.owner, v2.routing_tag, v2.status,
             v2.customer_name, v2.customer_email
      FROM context_store cs
      JOIN chat_v2_state v2 ON cs.conversation_id = v2.conversation_id
      WHERE v2.routing_tag = ? AND v2.status IN ('open', 'claimed')
      ORDER BY cs.updated_at DESC
    `).all(tag);
  }

  // --- System Config ---
  getSystemConfig() {
    const rows = this.db.raw.prepare('SELECT key, value FROM system_config').all() as { key: string; value: string }[];
    const config: Record<string, unknown> = {};
    for (const row of rows) {
      try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
    }
    return config;
  }

  updateSystemConfig(key: string, value: unknown) {
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    this.db.raw.prepare('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)').run(key, val);
  }

  // --- Operation Settings ---
  getOperationSettings() {
    const rows = this.db.raw.prepare('SELECT key, value FROM operation_settings').all() as { key: string; value: string }[];
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    }
    return settings;
  }

  saveOperationSetting(field: string, value: unknown) {
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    this.db.raw.prepare('INSERT OR REPLACE INTO operation_settings (key, value) VALUES (?, ?)').run(field, val);
  }

  // --- Email Blocklist ---
  getEmailBlocklist() {
    return this.db.raw.prepare('SELECT * FROM email_blocklist ORDER BY id DESC').all();
  }

  addEmailBlocklist(pattern: string) {
    const result = this.db.raw.prepare('INSERT INTO email_blocklist (pattern) VALUES (?)').run(pattern);
    return { id: result.lastInsertRowid, pattern };
  }

  deleteEmailBlocklist(id: number) {
    return this.db.raw.prepare('DELETE FROM email_blocklist WHERE id = ?').run(id);
  }

  // --- RAG ---
  getRagFailures() {
    return this.db.raw.prepare('SELECT * FROM rag_failures ORDER BY count DESC').all();
  }

  clearRagFailures() {
    return this.db.raw.prepare('DELETE FROM rag_failures').run();
  }
}
