// ============================================
// Unified API Service Layer
// Replaces all IPC bridges + fetch dual-paths
// ============================================

const getBaseUrl = (): string => {
  // In dev, Vite proxy handles routing to localhost:3001
  // In production, same origin serves both frontend and API
  return ''
}

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('atlas_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'ngrok-skip-browser-warning': 'true',
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBaseUrl()}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('atlas_token')
    localStorage.removeItem('atlas_user')
    window.location.reload()
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText)
    throw new Error(`API Error ${res.status}: ${errorText}`)
  }

  return res.json()
}

// ---- Auth ----
export const auth = {
  login: (username: string, password: string) =>
    request<{ token: string; user: import('../types').User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getUsers: () =>
    request<import('../types').User[]>('/api/auth/users'),
}

// ---- Offices ----
export const offices = {
  getAll: () =>
    request<import('../types').Office[]>('/api/public/offices'),
}

// ---- Team / Tickets ----
export const team = {
  fetchInbox: () =>
    request<import('../types').Ticket[]>('/team/inbox'),

  claimTicket: (conversationId: string) =>
    request<{ success: boolean; previousOwner?: string }>('/team/claim', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),

  getTicketMessages: (conversationId: string) =>
    request<import('../types').ChatMessage[]>(`/team/messages/${conversationId}`),

  sendMessage: (conversationId: string, message: string) =>
    request('/team/send', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message }),
    }),

  assignTicket: (conversationId: string, targetAgent: string) =>
    request('/team/assign', {
      method: 'POST',
      body: JSON.stringify({ conversationId, targetAgent }),
    }),

  archiveTicket: (conversationId: string) =>
    request('/team/archive', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),

  deleteTicket: (conversationId: string) =>
    request(`/team/delete/${conversationId}`, { method: 'DELETE' }),

  restoreTicket: (conversationId: string) =>
    request('/team/restore', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),
}

// ---- Archive ----
export const archive = {
  getAll: (params?: { search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    return request<{ items: import('../types').Ticket[]; total: number }>(
      `/api/archive?${query.toString()}`
    )
  },
}

// ---- Customers ----
export const customers = {
  getAll: (params?: { search?: string; page?: number }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.page) query.set('page', String(params.page))
    return request<{ customers: unknown[]; total: number }>(
      `/api/customers?${query.toString()}`
    )
  },

  getById: (id: string) =>
    request(`/api/customer/${id}`),

  getHistory: (conversationId: string) =>
    request(`/api/customer/history/${conversationId}`),
}

// ---- Templates ----
export const templates = {
  getAll: () =>
    request<import('../types').Template[]>('/api/templates'),

  save: (template: Partial<import('../types').Template>) =>
    request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    }),

  delete: (id: number) =>
    request(`/api/templates/${id}`, { method: 'DELETE' }),
}

// ---- Notes ----
export const notes = {
  getForTicket: (ticketId: string) =>
    request(`/api/notes/${ticketId}`),

  add: (ticketId: string, content: string) =>
    request('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ ticketId, content }),
    }),

  update: (noteId: number, content: string) =>
    request(`/api/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  delete: (noteId: number) =>
    request(`/api/notes/${noteId}`, { method: 'DELETE' }),
}

// ---- Knowledge ----
export const knowledge = {
  getAll: () => request('/api/knowledge'),
  reload: () => request('/api/knowledge/reload', { method: 'POST' }),
}

// ---- Admin ----
export const admin = {
  getUsers: () => request('/api/admin/users'),
  createUser: (data: Record<string, unknown>) =>
    request('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: Record<string, unknown>) =>
    request(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    request(`/api/admin/users/${id}`, { method: 'DELETE' }),

  getOffices: () => request('/api/admin/offices'),
  createOffice: (data: Record<string, unknown>) =>
    request('/api/admin/offices', { method: 'POST', body: JSON.stringify(data) }),
  updateOffice: (id: number, data: Record<string, unknown>) =>
    request(`/api/admin/offices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOffice: (id: number) =>
    request(`/api/admin/offices/${id}`, { method: 'DELETE' }),

  getConfig: () => request('/api/admin/config'),
  updateConfig: (data: Record<string, unknown>) =>
    request('/api/admin/config', { method: 'PUT', body: JSON.stringify(data) }),

  getAuditLog: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    return request(`/api/admin/audit?${query.toString()}`)
  },
}
