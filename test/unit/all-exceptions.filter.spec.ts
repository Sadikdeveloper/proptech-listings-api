import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

interface CapturedResponse {
  status: number;
  body: Record<string, unknown>;
}

function runFilter(exception: unknown, method = 'GET', url = '/listings'): CapturedResponse {
  const captured: CapturedResponse = { status: 0, body: {} };

  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method, originalUrl: url }),
      getResponse: () => ({
        status(code: number) {
          captured.status = code;
          return this;
        },
        json(body: Record<string, unknown>) {
          captured.body = body;
          return this;
        },
      }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return captured;
}

function prismaError(code: string, meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: '6.19.3',
    meta,
  });
}

describe('AllExceptionsFilter', () => {
  it('formats Nest HTTP exceptions', () => {
    const { status, body } = runFilter(new NotFoundException('Listing with id "1" was not found'));

    expect(status).toBe(404);
    expect(body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      error: 'Not Found',
      message: 'Listing with id "1" was not found',
      path: '/listings',
      method: 'GET',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('keeps the details array produced by the validation pipe', () => {
    const { status, body } = runFilter(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'price', messages: ['price must be greater than 0'] }],
      }),
    );

    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toEqual([
      { field: 'price', messages: ['price must be greater than 0'] },
    ]);
  });

  it.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2003', 409, 'CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
    ['P2000', 400, 'BAD_REQUEST'],
  ])('maps Prisma %s to %i', (code, expectedStatus, expectedCode) => {
    const { status, body } = runFilter(prismaError(code, { target: ['email'] }));

    expect(status).toBe(expectedStatus);
    expect(body.code).toBe(expectedCode);
  });

  it('names the conflicting field for unique constraint violations', () => {
    const { body } = runFilter(prismaError('P2002', { target: ['email'] }));

    expect(body.message).toContain('email');
  });

  it('handles a constaint violation that reports a single field name', () => {
    const { body } = runFilter(prismaError('P2003', { field_name: 'agent_id' }));

    expect(body.message).toContain('agent_id');
  });

  it('returns 503 when the database is unreachable', () => {
    const error = new Prisma.PrismaClientInitializationError('connection refused', '6.19.3');

    const { status, body } = runFilter(error);

    expect(status).toBe(503);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('never leaks internals for unexpected errors', () => {
    const { status, body } = runFilter(new Error('select * from secrets failed'));

    expect(status).toBe(500);
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain('secrets');
  });

  it('preserves the status of Express middleware errors', () => {
    const bodyParserError = Object.assign(new Error('request entity too large'), { status: 413 });

    const { status, body } = runFilter(bodyParserError);

    expect(status).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
