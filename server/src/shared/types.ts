// Shared types between server and client

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: 'admin' | 'agent';
  agent_color: string;
  avatar_id: number;
  status_text?: string;
  is_online?: boolean;
  office_id?: number;
  allowed_views?: string | null;
  offices?: string;
  password_hash?: string;
}

export interface Office {
  id: number;
  name: string;
  routing_tag: string;
  city: string;
  area: string;
  office_color: string;
  phone?: string;
  email?: string;
}

export interface Ticket {
  conversation_id: string;
  channel: 'chat' | 'mail';
  status: 'open' | 'claimed' | 'closed';
  routing_tag: string;
  owner: string | null;
  subject?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  last_message?: string;
  last_message_time?: string;
  created_at: string;
  updated_at: string;
  human_mode?: boolean;
  priority?: string;
  session_type?: string;
}

export interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface TicketNote {
  id: number;
  conversation_id: string;
  agent_name: string;
  content: string;
  created_at: string;
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
}
