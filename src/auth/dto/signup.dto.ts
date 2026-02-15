import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '../../common/enums';

export class SignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'User password (min 8 characters)',
    example: 'secureP@ss123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'User role (defaults to enduser)',
    enum: [UserType.ADMIN, UserType.ENDUSER],
    example: UserType.ENDUSER,
  })
  @IsEnum(UserType, {
    message: 'type must be either admin or enduser',
  })
  @IsOptional()
  type?: UserType.ADMIN | UserType.ENDUSER;
}
