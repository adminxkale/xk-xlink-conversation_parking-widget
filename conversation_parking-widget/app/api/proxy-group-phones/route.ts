import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');

  if (!groupId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: group_id' },
      { status: 400 },
    );
  }

  const xlinkBaseUrl = "https://zqi6swpat4.execute-api.us-east-1.amazonaws.com/dev/xlink_groups";

  if (!xlinkBaseUrl) {
    return NextResponse.json(
      { error: 'XLINK_GROUPS_API_URL is not configured' },
      { status: 500 },
    );
  }

  const url = `${xlinkBaseUrl}/${groupId}?partitionKey=group_id`;

  try {
    console.log(`[proxy-group-phones] GET → ${url}`);
    const apiRes = await fetch(url);

    if (!apiRes.ok) {
      console.error(`[proxy-group-phones] ${url} → ${apiRes.status}`);
      return NextResponse.json(
        { error: `Xlink Groups API returned status ${apiRes.status}` },
        { status: 502 },
      );
    }

    const data = await apiRes.json();
    return NextResponse.json(data, { status: apiRes.status });
  } catch (err) {
    console.error(`[proxy-group-phones] Failed to reach ${url}:`, err);
    return NextResponse.json(
      { error: 'Failed to connect to Xlink Groups API' },
      { status: 502 },
    );
  }
}
