import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queueId = searchParams.get('queueId');
  const token = request.headers.get('Authorization');

  if (!queueId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: queueId' },
      { status: 400 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401 },
    );
  }

  const environment = process.env.NEXT_PUBLIC_GENESYS_ENVIRONMENT ?? 'mypurecloud.com';
  const targetUrl = `https://api.${environment}/api/v2/routing/queues/${encodeURIComponent(queueId)}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown');
      console.error(`[proxy-queues] ${targetUrl} → ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `Genesys API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json({ id: data.id, name: data.name });
  } catch (err) {
    console.error(`[proxy-queues] Failed to reach ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'Failed to reach Genesys API' },
      { status: 502 },
    );
  }
}
