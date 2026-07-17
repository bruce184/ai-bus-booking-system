// Maps domain errors to gRPC status codes through the same shared
// ServiceError/toGrpcError pair every gRPC service uses (@bus/shared/errors.js)
// instead of a service-local error class, so trip-service, seat-inventory-service
// and booking-service all speak one error vocabulary. The GraphQL Gateway
// translates the resulting codes into docs/API_CONTRACT.md section 7.
// notFound/invalidArgument/internal/failedPrecondition keep their original
// call-site signature (`throw notFound(msg)`) so no caller needed to change.
import grpc from '@grpc/grpc-js';
import { ServiceError, toGrpcError } from '@bus/shared/errors.js';
import { readCorrelationId } from '@bus/shared/grpc.js';
import { runWithCorrelationId } from '@bus/shared/correlation.js';

export { ServiceError };

export const notFound = (msg = 'Resource not found') => new ServiceError('NOT_FOUND', msg);
export const invalidArgument = (msg = 'Invalid argument') => new ServiceError('VALIDATION_ERROR', msg);
export const internal = (msg = 'Internal service error') => new ServiceError('INTERNAL_ERROR', msg);
export const failedPrecondition = (msg = 'Operation precondition failed') =>
  new ServiceError('FAILED_PRECONDITION', msg);

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
// anything else becomes INTERNAL without crashing the server or leaking a raw
// internal error message to the caller.
export function wrap(name, handler, logger) {
  return async (call, callback) => {
    try {
      const result = await runWithCorrelationId(readCorrelationId(call), () => handler(call));
      callback(null, result);
    } catch (err) {
      const serviceError = err instanceof ServiceError
        ? err
        : mapDatabaseError(err);
      if (serviceError) {
        callback(toGrpcError(serviceError));
        return;
      }
      logger.error(`Unhandled error in ${name}`, err.stack || err.message);
      callback({ code: grpc.status.INTERNAL, message: 'Internal service error' });
    }
  };
}
