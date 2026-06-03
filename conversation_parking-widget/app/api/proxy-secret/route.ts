import { NextResponse } from 'next/server';

const BASE_URL = 'https://api-dev.xlinkapp.cloud/management-secret/secret';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const org = searchParams.get('org');

  if (!org) {
    return NextResponse.json(
      { error: 'Missing required query parameter: org' },
      { status: 400 },
    );
  }

  const stage = process.env.STAGE ?? '';
  const secretId = `/xlink/${stage}/integration/widget/${org}`;
  const targetUrl = `${BASE_URL}?secretId=${secretId}`;

  try {
    console.log(`[proxy-secret] GET → ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': buildBasicAuth(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown');
      console.error(`[proxy-secret] ${targetUrl} → ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `External API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();

    if (!data.genesys_client_id || !data.genesys_client_secret || !data.environment) {
      console.error(`[proxy-secret] Response missing required credential fields for org: ${org}. Got:`, JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: 'Credential retrieval failed: required fields not found in response' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      genesys_client_id: data.genesys_client_id,
      genesys_client_secret: data.genesys_client_secret,
      environment: data.environment,
    });
  } catch (err) {
    console.error(`[proxy-secret] Failed to process request:`, err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
