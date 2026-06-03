import { Line } from '../../domain/entities/line';

/** Shape of each object in the Xlink Groups API response. */
export interface XlinkGroupResponse {
  group_id: string;
  phone_numbers: Record<string, string>;
}

/**
 * Pure function that transforms a raw Xlink Groups API response into Line[].
 *
 * @param data  - The raw JSON body (expected to be an array of XlinkGroupResponse).
 * @param groupId - The group id to assign to every generated Line.
 * @returns Flat array of Line entities; empty array when data is not a valid array.
 */
export function parseXlinkGroupResponse(
  data: unknown,
  groupId: string,
): Line[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item: unknown) => {
    if (item === null || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const phoneNumbers = record.phone_numbers;

    if (
      phoneNumbers === null ||
      phoneNumbers === undefined ||
      typeof phoneNumbers !== 'object' ||
      Array.isArray(phoneNumbers)
    ) {
      return [];
    }

    const entries = Object.entries(phoneNumbers as Record<string, unknown>);
    if (entries.length === 0) {
      return [];
    }

    return entries.map(([name, phone]) => {
      const phoneStr = String(phone);
      return {
        id: phoneStr,
        number: name,
        phone_number_id: phoneStr,
        phone_number: phoneStr,
        groups: [groupId],
      } satisfies Line;
    });
  });
}

/**
 * Fetch phone numbers associated with a tenant.
 * Calls GET /api/proxy-group-phones?tenant={tenant}
 * Each returned line includes the groupId in its groups array.
 */
export async function fetchGroupPhones(groupId: string, tenant?: string): Promise<Line[]> {
  if (!tenant) {
    throw new Error('Tenant is required to fetch group phones');
  }

  const response = await fetch(
    `/api/proxy-group-phones?tenant=${encodeURIComponent(tenant)}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch group phones for group ${groupId}: ${response.status}`
    );
  }

  const data = await response.json();

  console.log('[fetchGroupPhones] Raw API response for group', groupId, ':', JSON.stringify(data, null, 2));

  const parsed = parseXlinkGroupResponse(data, groupId);
  console.log('[fetchGroupPhones] Parsed lines for group', groupId, ':', parsed);

  return parsed;
}

/**
 * Fallback: fetch all available channels when the agent has no groups.
 * Calls GET /api/proxy-channels
 */
export async function fetchChannels(): Promise<Line[]> {
  const response = await fetch('/api/proxy-channels');

  if (!response.ok) {
    throw new Error(`Failed to fetch channels: ${response.status}`);
  }

  const data = await response.json();

  const items: unknown[] = Array.isArray(data) ? data : data?.channels ?? [];

  return items.map((item: unknown) => {
    const record = item as Record<string, unknown>;
    const phoneNumber = String(record.phone_number ?? '');
    return {
      id: String(record.id ?? record.phone_number_id ?? phoneNumber),
      number: String(record.number ?? record.name ?? phoneNumber),
      phone_number_id: String(record.phone_number_id ?? record.id ?? ''),
      phone_number: phoneNumber,
    } satisfies Line;
  });
}
