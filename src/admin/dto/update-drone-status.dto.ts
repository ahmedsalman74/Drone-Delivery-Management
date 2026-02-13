import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DroneStatusUpdate {
  BROKEN = 'broken',
  FIXED = 'fixed',
}

export class UpdateDroneStatusDto {
  @ApiProperty({
    description: 'New drone status',
    enum: DroneStatusUpdate,
    example: DroneStatusUpdate.BROKEN,
  })
  @IsEnum(DroneStatusUpdate)
  status!: DroneStatusUpdate;
}
