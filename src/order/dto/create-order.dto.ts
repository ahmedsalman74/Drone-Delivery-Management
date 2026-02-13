import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: 'Origin latitude', example: 24.7136 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat!: number;

  @ApiProperty({ description: 'Origin longitude', example: 46.6753 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng!: number;

  @ApiProperty({ description: 'Destination latitude', example: 21.3891 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  destLat!: number;

  @ApiProperty({ description: 'Destination longitude', example: 39.8579 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  destLng!: number;
}
