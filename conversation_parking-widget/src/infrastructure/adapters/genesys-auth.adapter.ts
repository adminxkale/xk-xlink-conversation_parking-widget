const TOKEN_KEY = 'genesys_token';
const ENVIRONMENT_KEY = 'genesys_environment';
const CODE_VERIFIER_KEY = 'pkce_code_verifier';

// --- Module-level lock for deduplicating concurrent exchange requests ---
let exchangeInProgress: Promise<{ name: string; id: string; groupIds: string[]; token: string }> | null = null;

// --- PKCE Helpers ---

/**
 * Generate a cryptographically random code verifier (43-128 chars, unreserved URI chars).
 */
function generateCodeVerifier(length = 128): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array).slice(0, length);
}

/**
 * Compute SHA-256 code challenge from a code verifier.
 */
async function computeCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64url encode a Uint8Array (no padding, URL-safe).
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- Main Auth Functions ---

/**
 * Initiate the PKCE OAuth login flow against Genesys Cloud.
 *
 * Verification order (critical for React Strict Mode / Next.js double-execution):
 *
 * 1. Check localStorage for existing valid token
 *    → If valid: return immediately (ignore any ?code= in URL)
 *    → If invalid: clear and continue
 *
 * 2. Check if URL has ?code= (OAuth callback)
 *    → If exchange already in progress (lock): reuse the same promise
 *    → Otherwise: exchange code for token, store it, clean URL
 *
 * 3. No token, no code → Generate verifier/challenge → Redirect to Genesys
 *
 * @returns The authenticated user data (name, id, groupIds, token)
 */
export async function loginWithPKCE(
  clientId: string,
  environment: string
): Promise<{ name: string; id: string; groupIds: string[]; token: string }> {
  localStorage.setItem(ENVIRONMENT_KEY, environment);

  const redirectUri = window.location.origin + window.location.pathname;

  // --- STEP 1: Check for existing valid token in localStorage ---
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    try {
      const userInfo = await validateToken(storedToken, environment);

      // Clean residual ?code= from URL if present (can happen on reload after callback)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code')) {
        window.history.replaceState(null, '', redirectUri);
      }

      return { ...userInfo, token: storedToken };
    } catch {
      // Token expired or invalid — clear and continue to step 2
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  // --- STEP 2: Check if we're on the OAuth callback (?code= in URL) ---
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');

  if (authCode) {
    // If an exchange is already in progress (React Strict Mode double-execution),
    // reuse the same promise to avoid duplicate POSTs
    if (exchangeInProgress) {
      return exchangeInProgress;
    }

    // Start the exchange and store the promise as a lock
    exchangeInProgress = performCodeExchange(authCode, clientId, redirectUri, environment);

    try {
      const result = await exchangeInProgress;
      return result;
    } finally {
      // Always release the lock
      exchangeInProgress = null;
    }
  }

  // --- STEP 3: No token, no code → Initiate PKCE authorization flow ---
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await computeCodeChallenge(codeVerifier);

  // Store code_verifier in sessionStorage for use after redirect
  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

  // Redirect to Genesys Cloud authorization endpoint
  const authUrl =
    `https://login.${environment}/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}`;

  // Navigate away — this function will never resolve on first call
  window.location.href = authUrl;

  // This promise never resolves because the page navigates away
  return new Promise(() => {});
}

/**
 * Perform the code-for-token exchange.
 * Separated into its own function so the lock promise captures the entire operation.
 *
 * IMPORTANT: code_verifier is only removed from sessionStorage AFTER a successful exchange.
 * This prevents the second React Strict Mode execution from losing the verifier.
 */
async function performCodeExchange(
  authCode: string,
  clientId: string,
  redirectUri: string,
  environment: string
): Promise<{ name: string; id: string; groupIds: string[]; token: string }> {
  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!codeVerifier) {
    throw new Error('No se encontró el code_verifier. El flujo PKCE no se inició correctamente.');
  }

  // Exchange authorization code for access token
  const token = await exchangeCodeForToken(authCode, clientId, redirectUri, codeVerifier, environment);

  // Only remove code_verifier AFTER successful exchange
  sessionStorage.removeItem(CODE_VERIFIER_KEY);

  // Store token
  localStorage.setItem(TOKEN_KEY, token);

  // Clean URL (remove ?code=...&state=...)
  window.history.replaceState(null, '', redirectUri);

  // Fetch user info
  const userInfo = await validateToken(token, environment);

  console.log('[GenesysAuth] Agent authenticated via PKCE:', {
    name: userInfo.name,
    id: userInfo.id,
    groupIds: userInfo.groupIds,
  });

  return { ...userInfo, token };
}

/**
 * Exchange an authorization code for an access token via POST to /oauth/token.
 */
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  environment: string
): Promise<string> {
  const tokenUrl = `https://login.${environment}/oauth/token`;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access_token in token response');
  }

  return data.access_token;
}

/**
 * Extract access token from localStorage.
 * Used by services that need the raw token (notification service, proxy calls).
 */
export function extractToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get the stored Genesys environment domain.
 */
export function getStoredEnvironment(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ENVIRONMENT_KEY);
}

/**
 * Validate token by calling Genesys Cloud `/api/v2/users/me?expand=groups`.
 *
 * @param token - OAuth access token
 * @param environment - Genesys Cloud environment domain
 */
export async function validateToken(
  token: string,
  environment?: string
): Promise<{ name: string; id: string; groupIds: string[] }> {
  const resolvedEnvironment =
    environment ?? (typeof window !== 'undefined' ? localStorage.getItem(ENVIRONMENT_KEY) : null);

  if (!resolvedEnvironment) {
    throw new Error('Genesys environment is not available.');
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
 * Remove token from localStorage.
 */
export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * @deprecated Use loginWithPKCE instead.
 * Redirect to Genesys Cloud OAuth login page using implicit grant flow.
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
