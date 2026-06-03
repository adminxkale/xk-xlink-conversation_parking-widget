const TOKEN_KEY = 'genesys_token';
const ENVIRONMENT_KEY = 'genesys_environment';

/**
 * Extract access token from URL hash, query params, or localStorage.
 * If found in hash/query, stores it in localStorage.
 * Returns the first token found, or null if none.
 */
export function extractToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL hash (e.g., #access_token=xxx)
  const hash = window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash.substring(1));
    const hashToken = hashParams.get('access_token');
    if (hashToken) {
      localStorage.setItem(TOKEN_KEY, hashToken);
      // Clean hash from URL to prevent re-processing on reload
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return hashToken;
    }
  }

  // 2. Check URL query params
  const queryParams = new URLSearchParams(window.location.search);
  const queryToken = queryParams.get('access_token');
  if (queryToken) {
    localStorage.setItem(TOKEN_KEY, queryToken);
    // Clean query param to prevent re-processing
    queryParams.delete('access_token');
    const remaining = queryParams.toString();
    const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '');
    window.history.replaceState(null, '', cleanUrl);
    return queryToken;
  }

  // 3. Check localStorage
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    return storedToken;
  }

  return null;
}

/**
 * Validate token by calling Genesys Cloud `/api/v2/users/me?expand=groups`.
 * Returns user name, id, and group IDs.
 * Throws if validation fails.
 *
 * @param token - OAuth access token
 * @param environment - Genesys Cloud environment domain (e.g. mypurecloud.com).
 *   Falls back to localStorage('genesys_environment') if not provided.
 */
export async function validateToken(
  token: string,
  environment?: string
): Promise<{ name: string; id: string; groupIds: string[] }> {
  const resolvedEnvironment =
    environment ?? (typeof window !== 'undefined' ? localStorage.getItem(ENVIRONMENT_KEY) : null);

  if (!resolvedEnvironment) {
    throw new Error('Genesys environment is not available. Ensure redirectToLogin was called first.');
  }

  const response = await fetch(
    `https://api.${resolvedEnvironment}/api/v2/users/me?expand=groups`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Token validation failed with status ${response.status}`);
  }

  const data = await response.json();

  console.log('[GenesysAuth] Agent info retrieved:', {
    name: data.name,
    id: data.id,
    groupIds: Array.isArray(data.groups) ? data.groups.map((g: { id: string }) => g.id) : [],
  });

  const groupIds: string[] = Array.isArray(data.groups)
    ? data.groups.map((g: { id: string }) => g.id)
    : [];

  return {
    name: data.name ?? '',
    id: data.id ?? '',
    groupIds,
  };
}

/**
 * Redirect to Genesys Cloud OAuth login page using implicit grant flow.
 * Stores the environment in localStorage for use after redirect.
 *
 * @param clientId - Genesys Cloud OAuth client ID
 * @param environment - Genesys Cloud environment domain (e.g. mypurecloud.com)
 */
export function redirectToLogin(clientId: string, environment: string): void {
  localStorage.setItem(ENVIRONMENT_KEY, environment);

  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
  const url =
    `https://login.${environment}/oauth/authorize` +
    `?response_type=token` +
    `&client_id=${clientId}` +
    `&redirect_uri=${redirectUri}`;

  window.location.href = url;
}

/**
 * Remove token from localStorage.
 */
export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}
