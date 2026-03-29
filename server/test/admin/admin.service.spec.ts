import { Test } from '@nestjs/testing';
import { AdminService } from '../../src/admin/admin.service';
import { DatabaseService } from '../../src/database/database.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AdminService', () => {
  let service: AdminService;
  let db: any;

  beforeEach(async () => {
    db = {
      getAllUsers: jest.fn().mockReturnValue([]),
      getAllOffices: jest.fn().mockReturnValue([]),
      createUser: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      createOffice: jest.fn(),
      deleteOffice: jest.fn(),
      raw: {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          all: jest.fn().mockReturnValue([]),
          run: jest.fn(),
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('createUser', () => {
    it('hashes password and creates user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');

      await service.createUser({ username: 'newagent', password: 'secret123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12);
      expect(db.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newagent', password_hash: 'hashed-pw', role: 'agent' }),
      );
    });

    it('respects role parameter', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      await service.createUser({ username: 'admin2', password: 'pw', role: 'admin' });

      expect(db.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
      );
    });
  });

  describe('resetPassword', () => {
    it('hashes new password and updates DB', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');

      await service.resetPassword(5, 'newpass');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 12);
      expect(db.raw.prepare).toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('deletes user by ID', () => {
      service.deleteUser(5);
      expect(db.deleteUser).toHaveBeenCalledWith(5);
    });
  });

  describe('getUserStats', () => {
    it('returns stats for agent', () => {
      db.raw.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({
          active_tickets: 3, archived_tickets: 10, mail_handled: 5, internal_sent: 2,
        }),
      });

      const stats = service.getUserStats('patrik') as any;
      expect(stats.active_tickets).toBe(3);
      expect(stats.archived_tickets).toBe(10);
    });

    it('returns zeros when no stats found', () => {
      db.raw.prepare.mockReturnValue({ get: jest.fn().mockReturnValue(null) });

      const stats = service.getUserStats('nobody') as any;
      expect(stats).toEqual({ active_tickets: 0, archived_tickets: 0, mail_handled: 0, internal_sent: 0 });
    });
  });

  describe('offices', () => {
    it('creates office', () => {
      service.createOffice({ name: 'Test', routing_tag: 'test', city: 'Stockholm', area: 'City' });
      expect(db.createOffice).toHaveBeenCalled();
    });

    it('deletes office by tag', () => {
      service.deleteOffice('test_tag');
      expect(db.deleteOffice).toHaveBeenCalledWith('test_tag');
    });

    it('updates office color', () => {
      service.updateOfficeColor('goteborg_ullevi', '#ff0000');
      expect(db.raw.prepare).toHaveBeenCalled();
    });
  });

  describe('system config', () => {
    it('returns parsed config object', () => {
      db.raw.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue([
          { key: 'imap_enabled', value: 'true' },
          { key: 'backup_hours', value: '24' },
        ]),
      });

      const config = service.getSystemConfig();
      expect(config.imap_enabled).toBe(true);
      expect(config.backup_hours).toBe(24);
    });
  });

  describe('email blocklist', () => {
    it('adds blocklist entry', () => {
      db.raw.prepare.mockReturnValue({ run: jest.fn().mockReturnValue({ lastInsertRowid: 5 }) });

      const result = service.addEmailBlocklist('*@spam.com');
      expect(result.pattern).toBe('*@spam.com');
    });

    it('deletes blocklist entry', () => {
      service.deleteEmailBlocklist(3);
      expect(db.raw.prepare).toHaveBeenCalled();
    });
  });
});
