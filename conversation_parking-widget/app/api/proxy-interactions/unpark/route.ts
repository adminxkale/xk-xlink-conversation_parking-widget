import { NextResponse } from 'next/server';

const BASE_URL = 'https://api-dev.xlinkapp.cloud';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  console.log('[proxy-interactions/unpark] Body recibido del cliente:', JSON.stringify(body, null, 2));

  const { business, client, tenant } = body as {
    business?: string;
    client?: string;
    tenant?: string;
  };

  if (!business || !client || !tenant) {
    return NextResponse.json(
      { error: 'Missing required fields: business, client, tenant' },
      { status: 400 },
    );
  }

  const targetUrl = `${BASE_URL}/session-manager/${tenant}/${business}/${client}`;

  try {
    const payload = {
      parking: false,
    };

    console.log(`[proxy-interactions/unpark] PUT → ${targetUrl}`);
    console.log(`[proxy-interactions/unpark] Body:`, JSON.stringify(payload, null, 2));

    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': buildBasicAuth(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown');
      console.error(`[proxy-interactions/unpark] ${targetUrl} → ${response.status}: ${errorText}`);

      let userMessage = 'No se pudo desparquear la conversación. Intenta de nuevo.';
      if (response.status === 403) {
        userMessage = 'No tienes permisos para desparquear esta conversación.';
      } else if (response.status === 404) {
        userMessage = 'La conversación no fue encontrada o ya fue desparqueada.';
      }

      return NextResponse.json(
        { error: userMessage },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[proxy-interactions/unpark] Failed to reach ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'Failed to reach external API' },
      { status: 502 },
    );
  }
}
