import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ErrorCode, SearchQueryShape, ValidationErrorDetail } from '../types/api.types';
import { collectSearchQueryErrors } from '../validation/search-query.validator';
import { VALIDATION_FAILED_MESSAGE } from '../validation/validation-error.util';

/**
 * Runs after the global ValidationPipe and rejects query combinations that
 * single-field decorators cannot express (inverted ranges, half a coordinate
 * pair, a radius without a centre). Both listing endpoints use it.
 */
@Injectable()
export class ListingQueryValidationPipe
  implements PipeTransform<SearchQueryShape, SearchQueryShape>
{
  transform(value: SearchQueryShape): SearchQueryShape {
    const details: ValidationErrorDetail[] = collectSearchQueryErrors(value);
    if (details.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.ValidationFailed,
        message: VALIDATION_FAILED_MESSAGE,
        details,
      });
    }
    return value;
  }
}
