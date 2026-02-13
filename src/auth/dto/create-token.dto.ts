import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '../../common/enums';

export class CreateTokenDto {
  @ApiProperty({
    description: 'User name for identification',
    example: 'drone-alpha',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Type of user',
    enum: UserType,
    example: UserType.DRONE,
  })
  @IsEnum(UserType)
  @IsNotEmpty()
  type!: UserType;
}
