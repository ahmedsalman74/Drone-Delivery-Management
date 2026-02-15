import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'drone-delivery-jwt-secret-2024',
      ),
      passReqToCallback: true,
    });
  }

  /**
   * Validate the JWT payload and check if the token has been blacklisted.
   * This runs on every authenticated request.
   */
  async validate(
    req: { headers: { authorization?: string } },
    payload: JwtPayload,
  ): Promise<JwtPayload> {
    // Extract the raw token from the Authorization header
    const token = req.headers.authorization?.replace('Bearer ', '');

    // Check if the token has been blacklisted (user signed out)
    if (token) {
      const isBlacklisted = await this.authService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been invalidated');
      }
    }

    return {
      sub: payload.sub,
      name: payload.name,
      type: payload.type,
    };
  }
}
