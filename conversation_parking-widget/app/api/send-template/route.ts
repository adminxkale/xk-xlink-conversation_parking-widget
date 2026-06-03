import { NextResponse } from 'next/server';

const EXTERNAL_URL =
  'https://uqll2l7vg0.execute-api.us-east-1.amazonaws.com/dev/send-template';

const REQUIRED_FIELDS = ['destinationLine', 'conversationId'] as const;

const TIMEOUT_MS = 15_000;

export function buildBasicAuth(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function POST(request: Request) {
  // 1. Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // 2. Validate required fields
  const missing = REQUIRED_FIELDS.filter((f) => !body[f]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  // 3. Build Basic Auth
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  const authorization = buildBasicAuth(user, pass);

  // 4. Proxy to external endpoint
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`[send-template] POST → ${EXTERNAL_URL}`);
    const externalRes = await fetch(EXTERNAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        destinationLine: body.destinationLine,
        conversationId: body.conversationId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!externalRes.ok) {
      const text = await externalRes.text().catch(() => 'Unknown error');
      console.error(`[send-template] ${EXTERNAL_URL} → ${externalRes.status}: ${text}`);
      return NextResponse.json(
        { error: `External service error: ${text}` },
        { status: 502 },
      );
    }

    const data = await externalRes.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    clearTimeout(timeout);

    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`[send-template] Timeout reaching ${EXTERNAL_URL}`);
      return NextResponse.json(
        { error: 'External service timeout' },
        { status: 504 },
      );
    }

    console.error(`[send-template] Failed to reach ${EXTERNAL_URL}:`, err);
    return NextResponse.json(
      { error: 'Failed to reach external service' },
      { status: 502 },
    );
  }
}
