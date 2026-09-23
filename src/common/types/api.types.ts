export enum ErrorCode {
  ValidationFailed = 'VALIDATION_FAILED',
  BadRequest = 'BAD_REQUEST',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  PayloadTooLarge = 'PAYLOAD_TOO_LARGE',
  InternalError = 'INTERNAL_ERROR',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE',
}

export interface ValidationErrorDetail {
  field: string;
  messages: string[];
}

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  error: string;
  message: string | string[];
  details?: ValidationErrorDetail[];
  path: string;
  method: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationRequest {
  page: number;
  limit: number;
}

/** Shared shape inspected by the cross-field search validator. */
export interface SearchQueryShape {
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minBedrooms?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
