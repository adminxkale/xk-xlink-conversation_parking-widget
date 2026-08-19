import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.xlinkapp.cloud/management-multitenant/external/management-tables';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get('tenant');

  if (!tenant) {
    return NextResponse.json(
      { error: 'Missing required query parameter: tenant' },
      { status: 400 },
    );
  }

  const stage = process.env.STAGE ?? '';
  const tableName = `xlink-${stage}-group-genesys`;
  const targetUrl = `${BASE_URL}/${tableName}/${tenant}`;

  try {
    console.log(`[proxy-group-phones] GET → ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': buildBasicAuth(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown');
      console.error(`[proxy-group-phones] ${targetUrl} → ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `External API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[proxy-group-phones] Failed to reach ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'Failed to reach external API' },
      { status: 502 },
    );
  }
}
