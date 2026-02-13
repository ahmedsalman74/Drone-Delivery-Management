import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HeartbeatDto {
  @ApiProperty({ description: 'Current latitude', example: 24.7136 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ description: 'Current longitude', example: 46.6753 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
