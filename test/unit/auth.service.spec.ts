import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { UserType } from '../../src/common/enums';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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
