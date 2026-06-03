import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { GET as getTenant } from '@/app/api/proxy-tenant/route';
import { GET as getSecret } from '@/app/api/proxy-secret/route';

/**
 * Feature: multi-tenant-auth-flow
 * Property 7: Proxy routes never expose Basic Auth credentials in response bodies
 *
 * **Validates: Requirements 6.3, 6.4**
 *
 * For any valid or invalid request to proxy-tenant or proxy-secret, the response
 * body (serialized as string) does not contain the AUTH_USER or AUTH_PASS values,
 * nor the Base64-encoded Basic Auth header value.
 *
 * response_body_string.includes(AUTH_USER) === false
 * response_body_string.includes(AUTH_PASS) === false
 * response_body_string.includes(base64(AUTH_USER + ':' + AUTH_PASS)) === false
 */

/**
 * Generator for realistic credential strings.
 * Uses a prefix to ensure generated values won't accidentally match
 * common words in error messages (like "error", "missing", "org", etc.)
 */
const credentialArb = fc
  .string({ minLength: 4, maxLength: 30 })
  .filter((s) => /^[a-zA-Z0-9!@#$%^&*_+=~]{4,}$/.test(s))
  .map((s) => `cred_${s}`);

describe('Feature: multi-tenant-auth-flow, Property 7: Proxy routes never expose Basic Auth credentials in responses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASS;
    delete process.env.STAGE;
  });

  describe('proxy-tenant route', () => {
    it('valid requests (with org param) never expose credentials in response body', async () => {
      await fc.assert(
        fc.asyncProperty(
          credentialArb,
          credentialArb,
          fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
          async (authUser, authPass, org) => {
            vi.restoreAllMocks();

            process.env.AUTH_USER = authUser;
            process.env.AUTH_PASS = authPass;

            const base64Creds = Buffer.from(`${authUser}:${authPass}`).toString('base64');

            const upstreamResponse = { tenant_id: 'some-tenant-id' };
            vi.spyOn(global, 'fetch').mockResolvedValue(
              new Response(JSON.stringify(upstreamResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );

            const request = new Request(`http://localhost/api/proxy-tenant?org=${encodeURIComponent(org)}`);
            const response = await getTenant(request);
            const bodyText = JSON.stringify(await response.json());

            expect(bodyText.includes(authUser)).toBe(false);
            expect(bodyText.includes(authPass)).toBe(false);
            expect(bodyText.includes(base64Creds)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('invalid requests (missing org param) never expose credentials in response body', async () => {
      await fc.assert(
        fc.asyncProperty(
          credentialArb,
          credentialArb,
          async (authUser, authPass) => {
            vi.restoreAllMocks();

            process.env.AUTH_USER = authUser;
            process.env.AUTH_PASS = authPass;

            const base64Creds = Buffer.from(`${authUser}:${authPass}`).toString('base64');

            const request = new Request('http://localhost/api/proxy-tenant');
            const response = await getTenant(request);
            const bodyText = JSON.stringify(await response.json());

            expect(bodyText.includes(authUser)).toBe(false);
            expect(bodyText.includes(authPass)).toBe(false);
            expect(bodyText.includes(base64Creds)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('upstream error responses never expose credentials in response body', async () => {
      await fc.assert(
        fc.asyncProperty(
          credentialArb,
          credentialArb,
          fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
          fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
          async (authUser, authPass, org, statusCode) => {
            vi.restoreAllMocks();

            process.env.AUTH_USER = authUser;
            process.env.AUTH_PASS = authPass;

            const base64Creds = Buffer.from(`${authUser}:${authPass}`).toString('base64');

            vi.spyOn(global, 'fetch').mockResolvedValue(
              new Response('Upstream error', {
                status: statusCode,
                headers: { 'Content-Type': 'text/plain' },
              }),
            );

            const request = new Request(`http://localhost/api/proxy-tenant?org=${encodeURIComponent(org)}`);
            const response = await getTenant(request);
            const bodyText = JSON.stringify(await response.json());

            expect(bodyText.includes(authUser)).toBe(false);
            expect(bodyText.includes(authPass)).toBe(false);
            expect(bodyText.includes(base64Creds)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('proxy-secret route', () => {
    beforeEach(() => {
      process.env.STAGE = 'dev';
    });

    it('valid requests (with tenantId param) never expose credentials in response body', async () => {
      await fc.assert(
        fc.asyncProperty(
          credentialArb,
          credentialArb,
          fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
          async (authUser, authPass, tenantId) => {
            vi.restoreAllMocks();

            process.env.AUTH_USER = authUser;
            process.env.AUTH_PASS = authPass;
            process.env.STAGE = 'dev';

            const base64Creds = Buffer.from(`${authUser}:${authPass}`).toString('base64');

            const upstreamResponse = {
              genesys_client_id: 'cid-123',
              genesys_client_secret: 'csec-456',
              environment: 'mypurecloud.com',
            };
            vi.spyOn(global, 'fetch').mockResolvedValue(
              new Response(JSON.stringify(upstreamResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );

            const request = new Request(`http://localhost/api/proxy-secret?tenantId=${encodeURIComponent(tenantId)}`);
            const response = await getSecret(request);
            const bodyText = JSON.stringify(await response.json());

            expect(bodyText.includes(authUser)).toBe(false);
            expect(bodyText.includes(authPass)).toBe(false);
            expect(bodyText.includes(base64Creds)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('invalid requests (missing tenantId param) never expose credentials in response body', async () => {
      await fc.assert(
        fc.asyncProperty(
          credentialArb,
          credentialArb,
          async (authUser, authPass) => {
            vi.restoreAllMocks();

            process.env.AUTH_USER = authUser;
            process.env.AUTH_PASS = authPass;
            process.env.STAGE = 'dev';

            const base64Creds = Buffer.from(`${authUser}:${authPass}`).toString('base64');

            const request = new Request('http://localhost/api/proxy-secret');
            const response = await getSecret(request);
            const bodyText = JSON.stringify(await response.json());

            expect(bodyText.includes(authUser)).toBe(false);
            expect(bodyText.includes(authPass)).toBe(false);
            expect(bodyText.includes(base64Creds)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('upstream error responses never expose credentials in response body', async () => {
      await fc.assert(
        fc.asyncProperty(
          credentialArb,
          credentialArb,
          fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
          fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
          async (authUser, authPass, tenantId, statusCode) => {
            vi.restoreAllMocks();

            process.env.AUTH_USER = authUser;
            process.env.AUTH_PASS = authPass;
            process.env.STAGE = 'dev';

            const base64Creds = Buffer.from(`${authUser}:${authPass}`).toString('base64');

            vi.spyOn(global, 'fetch').mockResolvedValue(
              new Response('Upstream error', {
                status: statusCode,
                headers: { 'Content-Type': 'text/plain' },
              }),
            );

            const request = new Request(`http://localhost/api/proxy-secret?tenantId=${encodeURIComponent(tenantId)}`);
            const response = await getSecret(request);
            const bodyText = JSON.stringify(await response.json());

            expect(bodyText.includes(authUser)).toBe(false);
            expect(bodyText.includes(authPass)).toBe(false);
            expect(bodyText.includes(base64Creds)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
