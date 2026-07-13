// Maps domain errors to gRPC status codes. The GraphQL Gateway translates these
// into the standard error codes in docs/API_CONTRACT.md section 7.
import grpc from '@grpc/grpc-js';

export class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.grpcCode = code;
  }
}

export const notFound = (msg = 'Resource not found') =>
  new ServiceError(grpc.status.NOT_FOUND, msg);
export const invalidArgument = (msg = 'Invalid argument') =>
  new ServiceError(grpc.status.INVALID_ARGUMENT, msg);
export const internal = (msg = 'Internal service error') =>
  new ServiceError(grpc.status.INTERNAL, msg);
export const failedPrecondition = (msg = 'Operation precondition failed') =>
  new ServiceError(grpc.status.FAILED_PRECONDITION, msg);

export function mapDatabaseError(error) {
  switch (error?.code) {
    case '23505':
      return invalidArgument('Duplicate catalog value');
    case '23503':
      return failedPrecondition('Resource is still referenced and cannot be changed');
    case '23514':
      return invalidArgument('Input violates a catalog constraint');
    case '22P02':
      return invalidArgument('Input has an invalid identifier or value');
    default:
      return null;
  }
}

// Wraps an async handler so thrown ServiceErrors become proper gRPC errors and
// anything else becomes INTERNAL without crashing the server.
export function wrap(name, handler, logger) {
  return async (call, callback) => {
    try {
      const result = await handler(call);
      callback(null, result);
    } catch (err) {
      const serviceError = err instanceof ServiceError
        ? err
        : mapDatabaseError(err);
      if (serviceError) {
        callback({
          code: serviceError.grpcCode,
          message: serviceError.message,
        });
        return;
      }
      logger.error(`Unhandled error in ${name}`, err.stack || err.message);
      callback({ code: grpc.status.INTERNAL, message: 'Internal service error' });
    }
  };
}
