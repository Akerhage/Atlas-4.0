import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { DatabaseService } from '../../src/database/database.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let dbService: Partial<DatabaseService>;
  let jwtService: Partial<JwtService>;

  beforeEach(async () => {
    dbService = {
      getUserByUsername: jest.fn(),
      getAllUsers: jest.fn().mockReturnValue([]),
      updateUser: jest.fn(),
      updateUserPassword: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: dbService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('login', () => {
    it('returns token and user on valid credentials', async () => {
      const mockUser = {
        id: 1, username: 'patrik', password_hash: 'hashed',
        role: 'admin', agent_color: '#123456', display_name: 'Patrik',
        avatar_id: 2, status_text: 'Online',
      };
      (dbService.getUserByUsername as jest.Mock).mockReturnValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login('patrik', 'password123');

      expect(result.token).toBe('signed-token');
      expect(result.user.username).toBe('patrik');
      expect(result.user).not.toHaveProperty('password_hash');
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 1, username: 'patrik', role: 'admin' });
    });

    it('throws on invalid username', async () => {
      (dbService.getUserByUsername as jest.Mock).mockReturnValue(undefined);

      await expect(authService.login('nonexistent', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws on wrong password', async () => {
      (dbService.getUserByUsername as jest.Mock).mockReturnValue({
        id: 1, username: 'patrik', password_hash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('patrik', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getAllUsers', () => {
    it('returns user list without password hashes', () => {
      const users = [
        { id: 1, username: 'patrik', display_name: 'Patrik', role: 'admin', agent_color: '#fff', avatar_id: 0 },
        { id: 2, username: 'agent1', display_name: 'Agent', role: 'agent', agent_color: '#000', avatar_id: 1 },
      ];
      (dbService.getAllUsers as jest.Mock).mockReturnValue(users);

      const result = authService.getAllUsers();
      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('patrik');
    });
  });

  describe('changePassword', () => {
    it('updates password when old password is correct', async () => {
      (dbService.getUserByUsername as jest.Mock).mockReturnValue({
        id: 1, username: 'patrik', password_hash: 'oldhash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');

      await authService.changePassword('patrik', 'oldpass', 'newpass');

      expect(dbService.updateUserPassword).toHaveBeenCalledWith('patrik', 'newhash');
    });

    it('throws when old password is wrong', async () => {
      (dbService.getUserByUsername as jest.Mock).mockReturnValue({
        id: 1, username: 'patrik', password_hash: 'oldhash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.changePassword('patrik', 'wrong', 'new')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getServerVersion', () => {
    it('returns version 4.0', () => {
      expect(authService.getServerVersion()).toEqual({ version: '4.0' });
    });
  });
});
