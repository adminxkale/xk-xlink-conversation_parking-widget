import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

describe('GET /api/proxy-tenant', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.AUTH_USER = 'test-user';
    process.env.AUTH_PASS = 'test-pass';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASS;
    vi.restoreAllMocks();
  });

  it('returns 400 when org query parameter is missing', async () => {
    const request = new Request('http://localhost/api/proxy-tenant');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('org');
  });

  it('returns 200 with tenant_id on successful upstream response', async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ tenant_id: 'tenant-abc-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = new Request('http://localhost/api/proxy-tenant?org=test-org');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ tenant_id: 'tenant-abc-123' });
  });

  it('returns 502 when upstream responds with HTTP error', async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const request = new Request('http://localhost/api/proxy-tenant?org=test-org');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBeDefined();
  });

  it('returns 502 when upstream response does not contain tenant_id', async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ some_other_field: 'value' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = new Request('http://localhost/api/proxy-tenant?org=test-org');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('tenant_id');
  });
});
