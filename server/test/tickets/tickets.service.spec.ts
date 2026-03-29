import { Test } from '@nestjs/testing';
import { TicketsService } from '../../src/tickets/tickets.service';
import { DatabaseService } from '../../src/database/database.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let db: any;

  beforeEach(async () => {
    db = {
      getTeamInbox: jest.fn().mockReturnValue([]),
      getTicketById: jest.fn(),
      claimTicket: jest.fn(),
      assignTicket: jest.fn(),
      archiveTicket: jest.fn(),
      deleteConversation: jest.fn(),
      getArchivedTickets: jest.fn().mockReturnValue({ items: [], total: 0 }),
      raw: {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn(),
          all: jest.fn().mockReturnValue([]),
          run: jest.fn(),
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get(TicketsService);
  });

  describe('getInbox', () => {
    it('returns team inbox from database', () => {
      const tickets = [
        { conversation_id: 'conv-1', status: 'open', channel: 'chat' },
        { conversation_id: 'conv-2', status: 'claimed', channel: 'mail' },
      ];
      db.getTeamInbox.mockReturnValue(tickets);

      expect(service.getInbox()).toEqual(tickets);
      expect(db.getTeamInbox).toHaveBeenCalled();
    });
  });

  describe('claimTicket', () => {
    it('claims ticket and returns previous owner', () => {
      db.getTicketById.mockReturnValue({ conversation_id: 'conv-1', owner: 'old-agent' });
      db.claimTicket.mockReturnValue({ changes: 1 });

      const result = service.claimTicket('conv-1', 'new-agent');

      expect(result.success).toBe(true);
      expect(result.previousOwner).toBe('old-agent');
      expect(db.claimTicket).toHaveBeenCalledWith('conv-1', 'new-agent');
    });

    it('returns null previousOwner for unclaimed tickets', () => {
      db.getTicketById.mockReturnValue({ conversation_id: 'conv-1', owner: null });

      const result = service.claimTicket('conv-1', 'agent');
      expect(result.previousOwner).toBeNull();
    });
  });

  describe('assignTicket', () => {
    it('assigns ticket to target agent', () => {
      db.assignTicket.mockReturnValue({ changes: 1 });

      const result = service.assignTicket('conv-1', 'target-agent');
      expect(result.success).toBe(true);
      expect(db.assignTicket).toHaveBeenCalledWith('conv-1', 'target-agent');
    });
  });

  describe('archiveTicket', () => {
    it('archives the ticket', () => {
      db.archiveTicket.mockReturnValue({ changes: 1 });

      const result = service.archiveTicket('conv-1');
      expect(result.success).toBe(true);
    });
  });

  describe('deleteTicket', () => {
    it('deletes conversation from both tables', () => {
      const result = service.deleteTicket('conv-1');
      expect(result.success).toBe(true);
      expect(db.deleteConversation).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('getMessages', () => {
    it('parses JSON messages from context_store', () => {
      const messages = [{ role: 'user', content: 'hej' }, { role: 'atlas', content: 'hej!' }];
      db.raw.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ messages: JSON.stringify(messages) }),
      });

      expect(service.getMessages('conv-1')).toEqual(messages);
    });

    it('returns empty array when no messages', () => {
      db.raw.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
      });

      expect(service.getMessages('conv-1')).toEqual([]);
    });

    it('returns empty array on invalid JSON', () => {
      db.raw.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ messages: 'not-json' }),
      });

      expect(service.getMessages('conv-1')).toEqual([]);
    });
  });

  describe('getArchive', () => {
    it('passes search params to database', () => {
      service.getArchive('test query', 50, 0);
      expect(db.getArchivedTickets).toHaveBeenCalledWith('test query', 50, 0);
    });
  });
});
