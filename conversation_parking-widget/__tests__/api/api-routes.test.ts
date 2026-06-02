import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../../app/api/send-template/route';
import { GET as getGroupPhones } from '../../app/api/proxy-group-phones/route';
import { GET as getChannels } from '../../app/api/proxy-channels/route';

function buildPostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/send-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/send-template', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 400 with error mentioning missing fields when body is empty', async () => {
    const request = buildPostRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('destinationLine');
    expect(json.error).toContain('conversationId');
  });

  it('returns 400 mentioning conversationId when only destinationLine is provided', async () => {
    const request = buildPostRequest({ destinationLine: '+573001234567' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('conversationId');
    expect(json.error).not.toContain('destinationLine');
  });

  it('returns 502 when external endpoint fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Service Unavailable', { status: 503 }),
    );

    const request = buildPostRequest({
      destinationLine: '+573001234567',
      conversationId: 'conv-123',
    });
    const response = await POST(request);

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });
});

describe('GET /api/proxy-group-phones', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.XLINK_GROUPS_API_URL;

  beforeEach(() => {
    process.env.XLINK_GROUPS_API_URL = 'https://fake-xlink.example.com/xlink_groups';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.XLINK_GROUPS_API_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns phones for the given group_id', async () => {
    const xlinkResponse = [
      {
        group_id: 'grp-42',
        phone_numbers: { 'Line A': '+573001234567', 'Line B': '+573009876543' },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(xlinkResponse),
    });

    const request = new Request(
      'http://localhost/api/proxy-group-phones?group_id=grp-42',
    );
    const response = await getGroupPhones(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toEqual(xlinkResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://fake-xlink.example.com/xlink_groups/grp-42?partitionKey=group_id',
    );
  });

  it('returns 400 without group_id', async () => {
    const request = new Request('http://localhost/api/proxy-group-phones');
    const response = await getGroupPhones(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('group_id');
  });

  it('returns 500 when XLINK_GROUPS_API_URL is not configured', async () => {
    delete process.env.XLINK_GROUPS_API_URL;

    const request = new Request(
      'http://localhost/api/proxy-group-phones?group_id=grp-42',
    );
    const response = await getGroupPhones(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain('XLINK_GROUPS_API_URL');
  });

  it('returns 502 when Xlink API returns error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const request = new Request(
      'http://localhost/api/proxy-group-phones?group_id=grp-42',
    );
    const response = await getGroupPhones(request);

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toContain('503');
  });
});

describe('GET /api/proxy-channels', () => {
  it('returns channels with phone_number and name', async () => {
    const response = await getChannels();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    for (const channel of json) {
      expect(channel).toHaveProperty('phone_number');
      expect(channel).toHaveProperty('name');
    }
  });
});
