import { NextResponse } from 'next/server';

const BASE_URL = 'https://api-dev.xlinkapp.cloud/management-multitenant/external/management-tables/tenant';

export function buildBasicAuth(user?: string, pass?: string): string {
  const u = user ?? process.env.AUTH_USER ?? '';
  const p = pass ?? process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
}

export function buildTenantUrl(org: string): string {
  return `${BASE_URL}/${org}`;
}

export async function GET(request: Request) {
  console.log('[ENV CHECK]', {
    hasUser: !!process.env.AUTH_USER,
    hasPass: !!process.env.AUTH_PASS,
    stage: process.env.STAGE,
  });

  const { searchParams } = new URL(request.url);
  const org = searchParams.get('org');

  if (!org) {
    return NextResponse.json(
      { error: 'Missing required query parameter: org' },
      { status: 400 },
    );
  }

  const targetUrl = `${BASE_URL}/${org}`;

  try {
    console.log(`[proxy-tenant] GET → ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': buildBasicAuth(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown');
      console.error(`[proxy-tenant] ${targetUrl} → ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `External API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();

    if (!data.tenant_id) {
      console.error(`[proxy-tenant] Response missing tenant_id for org: ${org}`);
      return NextResponse.json(
        { error: 'Tenant resolution failed: tenant_id not found in response' },
        { status: 502 },
      );
    }

    return NextResponse.json({ tenant_id: data.tenant_id });
  } catch (err) {
    console.error(`[proxy-tenant] Failed to reach ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'Failed to reach external API' },
      { status: 502 },
    );
  }
}
