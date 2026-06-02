import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Get the Genesys token from the Authorization header (forwarded from client)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { queueId, toAddress, toAddressMessengerType } = body as {
    queueId?: string;
    toAddress?: string;
    toAddressMessengerType?: string;
  };

  if (!queueId || !toAddress) {
    return NextResponse.json(
      { error: 'Missing required fields: queueId, toAddress' },
      { status: 400 },
    );
  }

  const environment = process.env.NEXT_PUBLIC_GENESYS_ENVIRONMENT;
  if (!environment) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_GENESYS_ENVIRONMENT is not configured' },
      { status: 500 },
    );
  }

  const targetUrl = `https://api.${environment}/api/v2/conversations/messages`;

  try {
    const genesysBody = {
      queueId,
      toAddress,
      toAddressMessengerType: toAddressMessengerType ?? 'open',
      useExistingConversation: true,
    };
    console.log(`[proxy-conversations] POST → ${targetUrl}`);
    console.log(`[proxy-conversations] Body enviado a Genesys:`, JSON.stringify(genesysBody, null, 2));
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(genesysBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown');
      console.error(`[proxy-conversations] ${targetUrl} → ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `Genesys API error: ${response.status} - ${errorText}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[proxy-conversations] Failed to reach ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'Failed to reach Genesys API' },
      { status: 502 },
    );
  }
}
