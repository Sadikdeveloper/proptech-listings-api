import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { ErrorCode, ValidationErrorDetail } from '../types/api.types';

interface FailureDescription {
  status: number;
  code: ErrorCode;
  error: string;
  message: string | string[];
  details?: ValidationErrorDetail[];
}

const GENERIC_SERVER_ERROR = 'Internal server error';
const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad request',
  [HttpStatus.NOT_FOUND]: 'Resource not found',
  [HttpStatus.CONFLICT]: 'Request conflicts with the current state of the resource',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload too large',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service unavailable',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const failure = this.describe(exception);

    if (failure.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${failure.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.verbose(
        `${request.method} ${request.originalUrl} -> ${failure.status} (${failure.code})`,
      );
    }

    response.status(failure.status).json({
      statusCode: failure.status,
      code: failure.code,
      error: failure.error,
      message: failure.message,
      ...(failure.details ? { details: failure.details } : {}),
      path: request.originalUrl,
      method: request.method,
      timestamp: new Date().toISOString(),
    });
  }

  private describe(exception: unknown): FailureDescription {
    if (exception instanceof HttpException) {
      return this.describeHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.describePrismaKnownError(exception);
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: ErrorCode.ServiceUnavailable,
        error: 'Service Unavailable',
        message: 'The database is not reachable, please retry shortly',
      };
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ErrorCode.BadRequest,
        error: 'Bad Request',
        message: 'The request could not be translated into a valid database query',
      };
    }

    // Errors raised by Express middleware (for example a body larger than the
    // parser limit) carry a 4xx status but are not HttpExceptions.
    const clientStatus = this.statusFromError(exception);
    if (clientStatus) {
      return {
        status: clientStatus,
        code: this.codeForStatus(clientStatus, false),
        error: STATUS_CODES[clientStatus] ?? 'Request Failed',
        message: DEFAULT_MESSAGES[clientStatus] ?? 'Request failed',
      };
    }

    // Unexpected failures are logged with their stack but never echoed back.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalError,
      error: 'Internal Server Error',
      message: GENERIC_SERVER_ERROR,
    };
  }

  private statusFromError(exception: unknown): number | undefined {
    if (typeof exception !== 'object' || exception === null) {
      return undefined;
    }
    const candidate = exception as { status?: unknown; statusCode?: unknown };
    const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;

    return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
  }

  private describeHttpException(exception: HttpException): FailureDescription {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const fromPayload = typeof payload === 'object' && payload !== null ? payload : undefined;

    const details = (fromPayload as { details?: ValidationErrorDetail[] } | undefined)?.details;
    const explicitCode = (fromPayload as { code?: ErrorCode } | undefined)?.code;

    return {
      status,
      code: explicitCode ?? this.codeForStatus(status, Boolean(details?.length)),
      error: (fromPayload as { error?: string } | undefined)?.error ?? exception.name,
      message: this.extractMessage(payload, status, exception),
      ...(details?.length ? { details } : {}),
    };
  }

  private extractMessage(payload: string | object, status: number, exception: HttpException) {
    if (typeof payload === 'string') {
      return payload;
    }
    const raw = (payload as { message?: unknown }).message;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as string[];
    }
    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }
    return DEFAULT_MESSAGES[status] ?? exception.message;
  }

  private describePrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): FailureDescription {
    const target = this.describeTarget(exception.meta);

    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.Conflict,
          error: 'Conflict',
          message: target ? `A record with this ${target} already exists` : 'Duplicate value',
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.Conflict,
          error: 'Conflict',
          message: target
            ? `The referenced ${target} does not exist or is still in use`
            : 'Foreign key constraint violated',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.NotFound,
          error: 'Not Found',
          message: 'The requested record does not exist',
        };
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ErrorCode.BadRequest,
          error: 'Bad Request',
          message: 'One of the provided values is too long for its column',
        };
      default:
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.Conflict,
          error: 'Conflict',
          message: 'The request conflicts with the current state of the database',
        };
    }
  }

  private describeTarget(meta: unknown): string | undefined {
    const target = (meta as { target?: unknown } | undefined)?.target;
    if (Array.isArray(target)) {
      return target.join(', ');
    }
    if (typeof target === 'string') {
      return target;
    }
    const field = (meta as { field_name?: unknown } | undefined)?.field_name;
    return typeof field === 'string' ? field : undefined;
  }

  private codeForStatus(status: number, hasDetails: boolean): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return hasDetails ? ErrorCode.ValidationFailed : ErrorCode.BadRequest;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NotFound;
      case HttpStatus.CONFLICT:
        return ErrorCode.Conflict;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ErrorCode.PayloadTooLarge;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.ServiceUnavailable;
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? ErrorCode.InternalError
          : ErrorCode.BadRequest;
    }
  }
}
