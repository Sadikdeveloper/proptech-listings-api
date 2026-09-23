import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ErrorCode } from '../types/api.types';
import { flattenValidationErrors, VALIDATION_FAILED_MESSAGE } from './validation-error.util';

/**
 * Same behaviour as the stock pipe, but errors carry field level `details`
 * so clients can render them without parsing prose.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    stopAtFirstError: false,
    validationError: { target: false, value: false },
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        code: ErrorCode.ValidationFailed,
        message: VALIDATION_FAILED_MESSAGE,
        details: flattenValidationErrors(errors),
      }),
  });
}
