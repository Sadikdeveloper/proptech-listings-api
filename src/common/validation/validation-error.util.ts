import { ValidationError } from 'class-validator';
import { ValidationErrorDetail } from '../types/api.types';

const MAX_MESSAGES_PER_FIELD = 5;

/** Flattens the nested `ValidationError` tree the way clients want to read it. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own: ValidationErrorDetail[] = error.constraints
      ? [{ field: path, messages: Object.values(error.constraints).slice(0, MAX_MESSAGES_PER_FIELD) }]
      : [];
    const children = flattenValidationErrors(error.children ?? [], path);

    return [...own, ...children];
  });
}

export const VALIDATION_FAILED_MESSAGE = 'Validation failed';
