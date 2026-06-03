import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';

describe('GET /api/proxy-secret', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.AUTH_USER = 'test-user';
    process.env.AUTH_PASS = 'test-pass';
    process.env.STAGE = 'dev';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASS;
    delete process.env.STAGE;
    vi.restoreAllMocks();
  });

  it('returns 400 when tenantId query param is missing', async () => {
    const request = new Request('http://localhost/api/proxy-secret');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('tenantId');
  });

  it('returns 200 with only filtered credential fields on success', async () => {
    const upstreamData = {
      genesys_client_id: 'client-abc',
      genesys_client_secret: 'secret-xyz',
      environment: 'mypurecloud.com',
      extra_field: 'should-not-appear',
      internal_data: 'also-filtered',
    };

    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify(upstreamData), { status: 200 }),
    );

    const request = new Request('http://localhost/api/proxy-secret?tenantId=test-tenant');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      genesys_client_id: 'client-abc',
      genesys_client_secret: 'secret-xyz',
      environment: 'mypurecloud.com',
    });
    expect(body).not.toHaveProperty('extra_field');
    expect(body).not.toHaveProperty('internal_data');
  });

  it('returns 502 when upstream responds with non-ok status', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    const request = new Request('http://localhost/api/proxy-secret?tenantId=test-tenant');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('404');
  });

  it('returns 502 when upstream response is missing credential fields', async () => {
    const incompleteData = {
      genesys_client_id: 'client-abc',
      // missing genesys_client_secret and environment
    };

    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify(incompleteData), { status: 200 }),
    );

    const request = new Request('http://localhost/api/proxy-secret?tenantId=test-tenant');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('Credential retrieval failed');
  });

  it('returns 500 when fetch throws an unexpected error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network failure'));

    const request = new Request('http://localhost/api/proxy-secret?tenantId=test-tenant');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Internal server error');
  });
});
