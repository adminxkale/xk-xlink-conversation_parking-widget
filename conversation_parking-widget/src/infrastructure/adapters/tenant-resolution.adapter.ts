import { GenesysCredentials } from '@/src/domain/entities/tenant';

const ORG_KEY = 'xlink_org';
const CREDENTIALS_KEY = 'genesys_credentials';

/**
 * Extract org from URL query params or localStorage.
 * 1. Check URL for ?org=xxx parameter
 * 2. If present: store in localStorage('xlink_org'), remove param from URL without reload
 * 3. If absent: fallback to localStorage('xlink_org')
 * 4. If both absent: return error
 */
export function extractOrg(): { org: string } | { error: string } {
  if (typeof window === 'undefined') {
    return { error: 'No se pudo determinar la organización.' };
  }

  const queryParams = new URLSearchParams(window.location.search);
  const orgParam = queryParams.get('org');

  if (orgParam) {
    localStorage.setItem(ORG_KEY, orgParam);

    queryParams.delete('org');
    const remaining = queryParams.toString();
    const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '') + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);

    return { org: orgParam };
  }

  try {
    const storedOrg = localStorage.getItem(ORG_KEY);
    if (storedOrg) {
      return { org: storedOrg };
    }
  } catch {
    return { error: 'No se pudo determinar la organización.' };
  }

  return { error: 'No se encontró el parámetro de organización. Verifica la URL.' };
}

/**
 * Call proxy-tenant route to resolve tenant_id from org identifier.
 * Throws if the response is not ok.
 */
export async function resolveTenant(org: string): Promise<{ tenant_id: string }> {
  const response = await fetch(`/api/proxy-tenant?org=${encodeURIComponent(org)}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Error al resolver la organización.' }));
    throw new Error(data.error || 'Error al resolver la organización.');
  }

  return response.json();
}

/**
 * Call proxy-secret route to fetch Genesys credentials for a given org.
 * Throws if the response is not ok.
 */
export async function fetchGenesysCredentials(org: string): Promise<GenesysCredentials> {
  const response = await fetch(`/api/proxy-secret?org=${encodeURIComponent(org)}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Error al obtener credenciales.' }));
    throw new Error(data.error || 'Error al obtener credenciales.');
  }

  return response.json();
}

/**
 * Get cached credentials from localStorage.
 * Returns credentials only if stored org matches the provided org.
 * Returns null if org doesn't match or if parsing fails.
 */
export function getCachedCredentials(org: string): { credentials: GenesysCredentials; tenantId: string } | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { org: string; credentials: GenesysCredentials; tenantId?: string };
    if (parsed.org !== org) return null;

    return { credentials: parsed.credentials, tenantId: parsed.tenantId ?? '' };
  } catch {
    return null;
  }
}

/**
 * Store credentials in localStorage associated with the given org.
 */
export function setCachedCredentials(org: string, credentials: GenesysCredentials, tenantId: string): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ org, credentials, tenantId }));
}

/**
 * Remove cached credentials from localStorage.
 */
export function clearCachedCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}
