/** An error that maps directly to an HTTP status in route handlers. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (): HttpError => new HttpError(404, 'resource not found');
export const badRequest = (message: string): HttpError => new HttpError(400, message);
