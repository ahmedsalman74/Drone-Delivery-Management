import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateTokenDto } from './dto/create-token.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(dto: CreateTokenDto): { accessToken: string } {
    const payload = {
      sub: dto.name,
      name: dto.name,
      type: dto.type,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }
}
