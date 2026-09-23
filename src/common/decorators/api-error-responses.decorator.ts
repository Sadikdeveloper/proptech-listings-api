import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../dto/api-error-response.dto';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed or malformed input',
  404: 'Resource not found',
  409: 'Conflicting state (duplicate or referenced record)',
  503: 'Database unavailable',
};

export const ApiErrorResponses = (...statuses: number[]) =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status] ?? 'Request failed',
        type: ApiErrorResponseDto,
      }),
    ),
  );
