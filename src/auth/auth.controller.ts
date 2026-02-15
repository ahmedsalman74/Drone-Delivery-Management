import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { UserType } from '../common/enums';
import type { Request } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account with email and password.
   */
  @Post('signup')
  @ApiOperation({
    summary: 'Create a new user account',
    description:
      'Registers a new user with email, password, and display name. ' +
      'Returns a JWT token for immediate session start.',
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /**
   * Sign in with existing credentials.
   */
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Authenticates a user and returns a JWT token valid for 8 hours.',
  })
  @ApiResponse({ status: 200, description: 'Signed in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async signin(@Body() dto: SigninDto) {
    return this.authService.signin(dto);
  }

  /**
   * Sign out and invalidate the current JWT token.
   */
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign out and end the session',
    description:
      'Invalidates the current JWT token by adding it to a blacklist. ' +
      'The token will be rejected on subsequent requests.',
  })
  @ApiResponse({ status: 200, description: 'Signed out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async signout(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') ?? '';
    return this.authService.signout(token);
  }

  /**
   * Request a password reset link.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset',
    description:
      'Sends a password reset token for the given email address. ' +
      'In production, this would send an email; for assessment, the token is returned directly.',
  })
  @ApiResponse({ status: 200, description: 'Reset token generated' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * Reset password using a valid reset token.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description:
      'Resets the user password using a valid reset token received from the forgot-password endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Generate a JWT token for a drone. Requires admin authentication.
   */
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate JWT token for a drone (admin only)',
    description:
      'Issues a JWT bearer token for a drone. ' +
      'Only authenticated admin users can register drone tokens.',
  })
  @ApiResponse({ status: 200, description: 'JWT token generated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - admin token required' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  generateToken(@Body() dto: CreateTokenDto) {
    return this.authService.generateToken(dto);
  }
}
