/** An error that maps directly to an HTTP status in route handlers. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Stable machine-readable code the client can translate. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (): HttpError => new HttpError(404, 'resource not found', 'notFound');
export const conflict = (message: string, code: string): HttpError => new HttpError(409, message, code);
export const badRequest = (message: string, code?: string): HttpError => new HttpError(400, message, code);
