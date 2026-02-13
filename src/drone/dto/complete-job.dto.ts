import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CompletionResult {
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

export class CompleteJobDto {
  @ApiProperty({
    description: 'Result of the delivery',
    enum: CompletionResult,
    example: CompletionResult.DELIVERED,
  })
  @IsEnum(CompletionResult)
  result!: CompletionResult;
}
