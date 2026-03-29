import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TicketsService } from './tickets.service';
import { RagService } from '../rag/rag.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
})
export class TicketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private connectedAgents = new Map<string, string>(); // socketId → username

  constructor(
    private jwtService: JwtService,
    private ticketsService: TicketsService,
    private ragService: RagService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.emit('connect_error', { message: 'Authentication error' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      this.connectedAgents.set(client.id, payload.username);

      // Join agent's room
      client.join(`agent:${payload.username}`);

      // Emit server info
      client.emit('server:info', { version: '4.0' });

      // Broadcast presence update
      this.server.emit('presence:update', {
        username: payload.username,
        online: true,
      });

      console.log(`🟢 Agent connected: ${payload.username}`);
    } catch {
      client.emit('connect_error', { message: 'Authentication error' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const username = this.connectedAgents.get(client.id);
    if (username) {
      this.connectedAgents.delete(client.id);
      this.server.emit('presence:update', { username, online: false });
      console.log(`🔴 Agent disconnected: ${username}`);
    }
  }

  // --- Agent events ---

  @SubscribeMessage('team:agent_reply')
  handleAgentReply(
    @MessageBody() data: { conversationId: string; message: string; agent: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Broadcast to all agents that a reply was sent
    this.server.emit('team:customer_reply', {
      conversation_id: data.conversationId,
      message: data.message,
      agent: data.agent,
    });

    this.server.emit('team:update', { type: 'new_message', conversationId: data.conversationId });
  }

  @SubscribeMessage('team:send_email_reply')
  handleEmailReply(
    @MessageBody() data: { conversationId: string; message: string; agent: string },
  ) {
    // TODO: Wire to mail service for actual email sending
    this.server.emit('team:customer_reply', {
      conversation_id: data.conversationId,
      message: data.message,
      agent: data.agent,
    });
    this.server.emit('team:update', { type: 'new_message', conversationId: data.conversationId });
  }

  @SubscribeMessage('team:agent_typing')
  handleAgentTyping(
    @MessageBody() data: { conversationId: string; agent: string },
  ) {
    this.server.emit('client:agent_typing', data);
  }

  @SubscribeMessage('team:email_action')
  handleEmailAction(
    @MessageBody() data: { conversationId: string; action: string },
  ) {
    // TODO: Wire to RAG service for AI draft generation
    this.server.emit('ai:prediction', {
      conversationId: data.conversationId,
      draft: 'AI-genererat svarsutkast...',
    });
  }

  @SubscribeMessage('team:create_mail_ticket')
  handleCreateMailTicket(
    @MessageBody() data: { to: string; subject: string; body: string; agent: string },
  ) {
    // TODO: Wire to mail service
    this.server.emit('mail:ticket_created', data);
  }

  @SubscribeMessage('team:summarize_ticket')
  handleSummarizeTicket(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // TODO: Wire to RAG service
    client.emit('ticket:summary', {
      conversationId: data.conversationId,
      summary: 'Sammanfattning genereras...',
    });
  }

  // --- Customer events ---

  @SubscribeMessage('client:message')
  async handleClientMessage(
    @MessageBody() data: { query: string; sessionId: string; isFirstMessage?: boolean; session_type: string; context?: { locked_context?: Record<string, unknown> } },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const result = await this.ragService.query({
        query: data.query,
        sessionId: data.sessionId,
        isFirstMessage: data.isFirstMessage,
        session_type: data.session_type,
        context: data.context as any,
      });

      client.emit('server:answer', {
        answer: result.answer,
        sessionId: data.sessionId,
        locked_context: result.locked_context,
      });
    } catch (err) {
      console.error('RAG query error:', err);
      client.emit('server:error', {
        message: 'Ett fel uppstod vid bearbetning av frågan.',
      });
    }
  }

  @SubscribeMessage('client:typing')
  handleClientTyping(
    @MessageBody() data: { conversationId: string },
  ) {
    this.server.emit('team:client_typing', data);
  }

  @SubscribeMessage('client:end_chat')
  handleEndChat(
    @MessageBody() data: { conversationId: string },
  ) {
    this.server.emit('team:update', { type: 'ticket_archived', conversationId: data.conversationId });
  }

  // --- Admin broadcast ---

  @SubscribeMessage('admin:broadcast')
  handleAdminBroadcast(
    @MessageBody() data: { message: string },
  ) {
    this.server.emit('admin:notification', data);
  }

  @SubscribeMessage('agent:broadcast')
  handleAgentBroadcast(
    @MessageBody() data: { username: string; message: string },
  ) {
    this.server.to(`agent:${data.username}`).emit('admin:notification', {
      message: data.message,
    });
  }

  @SubscribeMessage('office:broadcast')
  handleOfficeBroadcast(
    @MessageBody() data: { office_tag: string; message: string },
  ) {
    // TODO: resolve agents for office and emit to each
    this.server.emit('admin:notification', data);
  }

  // --- Utility ---

  broadcastTeamUpdate(type: string, conversationId?: string) {
    this.server.emit('team:update', { type, conversationId });
  }
}
