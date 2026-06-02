const TOKEN_KEY = 'genesys_token';

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
 */
export async function validateToken(
  token: string
): Promise<{ name: string; id: string; groupIds: string[] }> {
  const environment = process.env.NEXT_PUBLIC_GENESYS_ENVIRONMENT;
  if (!environment) {
    throw new Error('NEXT_PUBLIC_GENESYS_ENVIRONMENT is not configured');
  }

  const response = await fetch(
    `https://api.${environment}/api/v2/users/me?expand=groups`,
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
 */
export function redirectToLogin(): void {
  const clientId = process.env.NEXT_PUBLIC_GENESYS_CLIENT_ID;
  const environment = process.env.NEXT_PUBLIC_GENESYS_ENVIRONMENT;

  if (!clientId || !environment) {
    throw new Error(
      'NEXT_PUBLIC_GENESYS_CLIENT_ID and NEXT_PUBLIC_GENESYS_ENVIRONMENT must be configured'
    );
  }

  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
  const url =
    `https://login.${environment}/oauth/authorize` +
    `?client_id=${clientId}` +
    `&response_type=token` +
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
