import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { GET } from '@/app/api/proxy-secret/route';

/**
 * Feature: multi-tenant-auth-flow
 * Property 5: Secret resolver response filtering
 *
 * **Validates: Requirements 6.6**
 *
 * For any JSON response from the Xlink API (with arbitrary extra fields),
 * the Secret_Resolver returns only the fields `genesys_client_id`,
 * `genesys_client_secret`, and `environment`. No other keys from the
 * original response appear in the output.
 *
 * output_keys ⊆ { 'genesys_client_id', 'genesys_client_secret', 'environment' }
 */
describe('Feature: multi-tenant-auth-flow, Property 5: Secret resolver response filtering', () => {
  const ALLOWED_KEYS = ['genesys_client_id', 'genesys_client_secret', 'environment'];

  beforeEach(() => {
    process.env.AUTH_USER = 'test-user';
    process.env.AUTH_PASS = 'test-pass';
    process.env.STAGE = 'dev';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASS;
    delete process.env.STAGE;
  });

  it('response only contains allowed keys regardless of extra fields in upstream response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.dictionary(
          fc.string({ minLength: 1 }).filter(
            (k) => !ALLOWED_KEYS.includes(k)
          ),
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
        ),
        async (clientId, clientSecret, environment, extraFields) => {
          vi.restoreAllMocks();

          const upstreamResponse = {
            genesys_client_id: clientId,
            genesys_client_secret: clientSecret,
            environment: environment,
            ...extraFields,
          };

          vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(upstreamResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );

          const request = new Request('http://localhost/api/proxy-secret?tenantId=test-tenant');
          const response = await GET(request);
          const body = await response.json();

          const responseKeys = Object.keys(body);
          for (const key of responseKeys) {
            expect(ALLOWED_KEYS).toContain(key);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: multi-tenant-auth-flow
 * Property 4: Secret resolver URL construction includes both STAGE and tenantId
 *
 * **Validates: Requirements 3.1**
 *
 * For any non-empty STAGE and tenantId, the URL constructed by the
 * Secret_Resolver contains both values in the correct positions within
 * the secretId parameter.
 *
 * secretId = `/xlink/${STAGE}/integration/widget/${tenantId}`
 * secretId.includes(STAGE) && secretId.includes(tenantId)
 */
describe('Feature: multi-tenant-auth-flow, Property 4: Secret resolver URL construction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASS;
    delete process.env.STAGE;
  });

  it('fetch is called with a URL containing both STAGE and tenantId values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
        fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (stage, tenantId) => {
          vi.restoreAllMocks();

          process.env.AUTH_USER = 'test-user';
          process.env.AUTH_PASS = 'test-pass';
          process.env.STAGE = stage;

          const mockResponse = {
            genesys_client_id: 'cid',
            genesys_client_secret: 'csecret',
            environment: 'mypurecloud.com',
          };

          const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(mockResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );

          const request = new Request(`http://localhost/api/proxy-secret?tenantId=${tenantId}`);
          await GET(request);

          expect(fetchSpy).toHaveBeenCalledOnce();
          const calledUrl = fetchSpy.mock.calls[0][0] as string;

          const expectedSecretId = `/xlink/${stage}/integration/widget/${tenantId}`;
          const decodedUrl = decodeURIComponent(calledUrl);

          expect(decodedUrl).toContain(stage);
          expect(decodedUrl).toContain(tenantId);
          expect(decodedUrl).toContain(expectedSecretId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
