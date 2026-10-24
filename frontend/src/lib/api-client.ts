// Client-side fetch wrapper for the REST API (mutations from Client Components).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') message = body.error;
      if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') code = body.code;
    } catch {
      // non-JSON error body: keep the generic message
    }
    throw new ApiError(res.status, message, code);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
