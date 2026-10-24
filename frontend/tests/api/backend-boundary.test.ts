import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock, headersMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock('@/server/auth/auth', () => ({ getSession: getSessionMock }));
vi.mock('next/headers', () => ({ headers: headersMock }));

import { backendJson, proxyToBackend } from '@/server/backend/client';

describe('Rust backend gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BACKEND_URL = 'http://127.0.0.1:8080';
    process.env.BACKEND_SERVICE_TOKEN = 'server-only-token';
  });

  it('replaces browser identity headers with the authenticated user', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user-from-session' } });
    const upstream = vi.fn().mockResolvedValue(new Response('{"data":[]}', {
      status: 200,
      headers: { 'cache-control': 'public, max-age=60' },
    }));
    vi.stubGlobal('fetch', upstream);
    const request = new Request('http://web.test/api/v1/accounts', {
      method: 'GET',
      headers: {
        Cookie: 'session_token=browser-session',
        Authorization: 'Bearer forged-token',
        'x-cfk-user-id': 'forged-user',
      },
    });

    const response = await proxyToBackend(request, '/api/v1/accounts');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [, init] = upstream.mock.calls[0] as [string, RequestInit];
    const sent = new Headers(init.headers);
    expect(sent.get('authorization')).toBe('Bearer server-only-token');
    expect(sent.get('x-cfk-user-id')).toBe('user-from-session');
    expect(sent.get('cookie')).toBeNull();
  });

  it('forwards the public finance route and query to the configured Rust backend', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user-from-session' } });
    const upstream = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal('fetch', upstream);
    const request = new Request('http://web.test/api/v1/accounts?kind=cash', { method: 'GET' });

    await proxyToBackend(request, '/api/v1/accounts');

    expect(upstream).toHaveBeenCalledOnce();
    const [url] = upstream.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://127.0.0.1:8080/api/v1/accounts?kind=cash');
  });

  it('returns the existing unauthorized envelope without calling Rust', async () => {
    getSessionMock.mockResolvedValue(null);
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await proxyToBackend(new Request('http://web.test/api/v1/accounts'), '/api/v1/accounts');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'not signed in', code: 'unauthorized' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('uses the same verified identity for Server Component reads', async () => {
    const requestHeaders = new Headers({ Cookie: 'session_token=browser-session', 'x-cfk-user-id': 'forged-user' });
    headersMock.mockResolvedValue(requestHeaders);
    getSessionMock.mockResolvedValue({ user: { id: 'user-from-session' } });
    const upstream = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal('fetch', upstream);

    await backendJson<{ data: unknown[] }>('/api/v1/accounts');

    const [, init] = upstream.mock.calls[0] as [string, RequestInit];
    const sent = new Headers(init.headers);
    expect(sent.get('authorization')).toBe('Bearer server-only-token');
    expect(sent.get('x-cfk-user-id')).toBe('user-from-session');
  });
  it('returns a generic gateway failure without exposing the private address', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user-from-session' } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED http://private-rust.internal:8080')));
    const response = await proxyToBackend(new Request('http://web.test/api/v1/accounts'), '/api/v1/accounts');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'backend unavailable', code: 'backend_unavailable' });
  });

  it('does not forward private upstream headers to the browser', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user-from-session' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: {
      location: 'http://private-rust.internal:8080', server: 'rust-private', 'x-cfk-user-id': 'private-user',
    } })));
    const response = await proxyToBackend(new Request('http://web.test/api/v1/accounts'), '/api/v1/accounts');
    for (const name of ['location', 'server', 'x-cfk-user-id']) expect(response.headers.has(name)).toBe(false);
  });

});
