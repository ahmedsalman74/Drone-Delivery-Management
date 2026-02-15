import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { TokenBlacklist } from './entities/token-blacklist.entity';
import { CreateTokenDto } from './dto/create-token.dto';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserType } from '../common/enums';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: MongoRepository<User>,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: MongoRepository<TokenBlacklist>,
  ) {}

  /**
   * Register a new user account.
   * Password is hashed with bcrypt before storage.
   */
  async signup(
    dto: SignupDto,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    // Check for existing user
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = this.userRepository.create({
      id: randomUUID(),
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      type: dto.type ?? UserType.ENDUSER,
    });
    const savedUser = await this.userRepository.save(user);

    // Generate JWT
    const accessToken = this.createToken(savedUser);

    return {
      accessToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        type: savedUser.type,
      },
    };
  }

  /**
   * Authenticate a user with email and password.
   * Returns a JWT token valid for 8 hours.
   */
  async signin(
    dto: SigninDto,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.createToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        type: user.type,
      },
    };
  }

  /**
   * Invalidate a JWT token by adding it to the blacklist.
   * The token will be rejected on subsequent requests.
   */
  async signout(token: string): Promise<{ message: string }> {
    // Decode token to get expiration time
    const decoded = this.jwtService.decode<{ exp?: number }>(token);
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 8 * 60 * 60 * 1000); // fallback: 8h

    // Add token to blacklist
    const blacklistEntry = this.tokenBlacklistRepository.create({
      token,
      expiresAt,
    });
    await this.tokenBlacklistRepository.save(blacklistEntry);

    return { message: 'Successfully signed out' };
  }

  /**
   * Check if a token has been blacklisted (signed out).
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const entry = await this.tokenBlacklistRepository.findOne({
      where: { token },
    });
    return !!entry;
  }

  /**
   * Initiate a password reset flow.
   * In production, this would send an email with a reset link.
   * For this assessment, we generate a reset token and return it directly.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate a short-lived reset token (15 minutes)
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, purpose: 'password-reset' },
      { expiresIn: '15m' },
    );

    // In production: send email with reset link
    // For assessment: return the token directly
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
      resetToken, // Would be sent via email in production
    };
  }

  /**
   * Reset a user's password using a valid reset token.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify<{ sub: string; purpose: string }>(
        dto.token,
      );
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid reset token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.password = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepository.save(user);

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Generate a self-signed JWT token for drone auto-registration.
   * Kept for backward compatibility with drone operations.
   */
  generateToken(dto: CreateTokenDto): { accessToken: string } {
    const payload = {
      sub: dto.name,
      name: dto.name,
      type: dto.type,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  /**
   * Clean up expired blacklisted tokens (housekeeping).
   */
  async cleanExpiredTokens(): Promise<void> {
    const allTokens = await this.tokenBlacklistRepository.find();
    const now = new Date();
    for (const entry of allTokens) {
      if (entry.expiresAt < now) {
        await this.tokenBlacklistRepository.delete(entry._id);
      }
    }
  }

  /**
   * Create a JWT token for a user.
   */
  private createToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      name: user.name,
      type: user.type,
      email: user.email,
    });
  }
}
