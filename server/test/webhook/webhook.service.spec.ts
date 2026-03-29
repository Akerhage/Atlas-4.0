import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from '../../src/webhook/webhook.service';
import { DatabaseService } from '../../src/database/database.service';
import { RagService } from '../../src/rag/rag.service';

describe('WebhookService', () => {
  let service: WebhookService;
  let db: any;
  let ragService: any;
  let configService: any;

  beforeEach(async () => {
    db = {
      raw: {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          all: jest.fn().mockReturnValue([]),
          run: jest.fn(),
        }),
      },
    };

    ragService = {
      query: jest.fn().mockResolvedValue({ answer: 'AI svar', locked_context: {} }),
    };

    configService = {
      get: jest.fn().mockReturnValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: DatabaseService, useValue: db },
        { provide: RagService, useValue: ragService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(WebhookService);
  });

  describe('verifySignature', () => {
    it('returns false when no secret configured', () => {
      configService.get.mockReturnValue(null);
      expect(service.verifySignature(Buffer.from('test'), 'sig')).toBe(false);
    });

    it('returns false for temp secret', () => {
      configService.get.mockReturnValue('temp_secret_12345');
      expect(service.verifySignature(Buffer.from('test'), 'sig')).toBe(false);
    });
  });

  describe('handleLhcChat', () => {
    it('ignores empty messages', async () => {
      const result = await service.handleLhcChat({ chat_id: '', id: 1, msg: '', type: 'chat' });
      expect(result.status).toBe('ignored');
    });

    it('detects human trigger and escalates', async () => {
      const result = await service.handleLhcChat({
        chat_id: 'chat-1', id: 1, msg: 'Jag vill prata med människa', type: 'chat',
      });

      expect(result.status).toBe('escalated');
      expect(db.raw.prepare).toHaveBeenCalled();
    });

    it('processes RAG query for non-trigger messages', async () => {
      const result = await service.handleLhcChat({
        chat_id: 'chat-1', id: 1, msg: 'Vad kostar körkort?', type: 'chat',
      });

      expect(result.status).toBe('answered');
      expect(ragService.query).toHaveBeenCalledWith(expect.objectContaining({ query: 'Vad kostar körkort?' }));
    });

    it('returns duplicate for already-processed messages', async () => {
      db.raw.prepare.mockReturnValue({
        get: jest.fn()
          .mockReturnValueOnce(null) // v2State
          .mockReturnValueOnce({ context_data: '{}', last_message_id: 5 }), // contextRow with id 5
        all: jest.fn().mockReturnValue([]),
        run: jest.fn(),
      });

      const result = await service.handleLhcChat({
        chat_id: 'chat-1', id: 3, msg: 'duplicate', type: 'chat', // id 3 <= last_message_id 5
      });

      expect(result.status).toBe('duplicate');
    });
  });
});
