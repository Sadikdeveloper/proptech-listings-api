import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode, ValidationErrorDetail } from '../types/api.types';

export class ValidationErrorDetailDto implements ValidationErrorDetail {
  @ApiProperty({ example: 'price' })
  field: string;

  @ApiProperty({ example: ['price must not be less than 0'], type: [String] })
  messages: string[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ enum: ErrorCode, example: ErrorCode.ValidationFailed })
  code: ErrorCode;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Validation failed',
  })
  message: string | string[];

  @ApiPropertyOptional({ type: [ValidationErrorDetailDto] })
  details?: ValidationErrorDetailDto[];

  @ApiProperty({ example: '/listings?price=abc' })
  path: string;

  @ApiProperty({ example: 'GET' })
  method: string;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  timestamp: string;
}
