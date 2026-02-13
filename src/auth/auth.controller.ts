import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateTokenDto } from './dto/create-token.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate JWT token',
    description:
      'Issues a self-signed JWT bearer token for the given user name and type. ' +
      'This endpoint is public and would be behind an allow-list in production.',
  })
  @ApiResponse({ status: 200, description: 'JWT token generated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  generateToken(@Body() dto: CreateTokenDto) {
    return this.authService.generateToken(dto);
  }
}
