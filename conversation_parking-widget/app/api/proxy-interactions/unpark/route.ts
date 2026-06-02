import { NextResponse } from 'next/server';

const BASE_URL = 'https://1p7yki6h17.execute-api.us-east-1.amazonaws.com/dev';

function buildBasicAuth(): string {
  const user = process.env.NEXT_PUBLIC_BASIC_AUTH_USER ?? '';
  //const pass = process.env.NEXT_PUBLIC_BASIC_AUTH_PASS ?? '';
  const pass = 'fZ9#nLp8@V2cM^wXr1*JqT6$BdKsZ3yRv!Ah7NgX%Um5LjEo^CpWx8#QdFbGtHk9';
  console.log(`[proxy-interactions/unpark] Auth user: "${user}", pass: "${pass}"`);
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

  const { business, client, agentId, agentName, queueId } = body as {
    business?: string;
    client?: string;
    agentId?: string;
    agentName?: string;
    queueId?: string;
  };

  if (!business || !client) {
    return NextResponse.json(
      { error: 'Missing required fields: business, client' },
      { status: 400 },
    );
  }

  const targetUrl = `${BASE_URL}/${business}/${client}/`;

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
