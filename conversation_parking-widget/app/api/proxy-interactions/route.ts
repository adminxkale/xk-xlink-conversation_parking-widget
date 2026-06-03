import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.xlinkapp.cloud';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');
  const tenant = searchParams.get('tenant');

  if (!agentId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: agent_id' },
      { status: 400 },
    );
  }

  if (!tenant) {
    return NextResponse.json(
      { error: 'Missing required query parameter: tenant' },
      { status: 400 },
    );
  }

  const targetUrl = `${BASE_URL}/session-manager/${tenant}/agent/${agentId}`;

  try {
    console.log(`[proxy-interactions] GET → ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': buildBasicAuth(),
      },
    });

    if (!response.ok) {
      // 404 means no sessions for this agent — return empty data, not an error
      if (response.status === 404) {
        return NextResponse.json({
          statusCode: 200,
          message: 'No existen sesiones para este agente',
          total: 0,
          data: [],
        });
      }

      const errorText = await response.text().catch(() => 'Unknown');
      console.error(`[proxy-interactions] ${targetUrl} → ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `External API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[proxy-interactions] Failed to reach ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'Failed to reach external API' },
      { status: 502 },
    );
  }
}
