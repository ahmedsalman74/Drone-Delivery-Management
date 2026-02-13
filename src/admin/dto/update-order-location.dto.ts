import { IsNumber, Min, Max, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrderLocationDto {
  @ApiPropertyOptional({ description: 'New origin latitude', example: 24.7136 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat?: number;

  @ApiPropertyOptional({ description: 'New origin longitude', example: 46.6753 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng?: number;

  @ApiPropertyOptional({ description: 'New destination latitude', example: 21.3891 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  destLat?: number;

  @ApiPropertyOptional({ description: 'New destination longitude', example: 39.8579 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  destLng?: number;
}
