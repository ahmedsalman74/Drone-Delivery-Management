import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from '../../src/auth/auth.service';
import { User } from '../../src/auth/entities/user.entity';
import { TokenBlacklist } from '../../src/auth/entities/token-blacklist.entity';
import { UserType } from '../../src/common/enums';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTokenBlacklistRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            decode: jest.fn().mockReturnValue({ exp: 9999999999 }),
            verify: jest.fn().mockReturnValue({
              sub: 'user-id',
              purpose: 'password-reset',
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(TokenBlacklist),
          useValue: mockTokenBlacklistRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateToken (backward compat)', () => {
    it('should generate a token with correct payload', () => {
      const dto = { name: 'test-user', type: UserType.ENDUSER };
      const result = service.generateToken(dto);

      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'test-user',
        name: 'test-user',
        type: UserType.ENDUSER,
      });
    });

    it('should generate token for drone type', () => {
      const dto = { name: 'drone-alpha', type: UserType.DRONE };
      service.generateToken(dto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'drone-alpha',
        name: 'drone-alpha',
        type: UserType.DRONE,
      });
    });

    it('should generate token for admin type', () => {
      const dto = { name: 'admin-user', type: UserType.ADMIN };
      service.generateToken(dto);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'admin-user',
        name: 'admin-user',
        type: UserType.ADMIN,
      });
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for non-blacklisted token', async () => {
      mockTokenBlacklistRepository.findOne.mockResolvedValue(null);
      const result = await service.isTokenBlacklisted('valid-token');
      expect(result).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      mockTokenBlacklistRepository.findOne.mockResolvedValue({ token: 'x' });
      const result = await service.isTokenBlacklisted('blacklisted-token');
      expect(result).toBe(true);
    });
  });
});
