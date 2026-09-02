/**
 * Genesys Cloud OAuth — Authorization Code Grant with PKCE + Popup Window
 *
 * Siempre usa pop-up window para el login, evitando restricciones de iframe.
 * Compatible con React Strict Mode y Next.js.
 */

const TOKEN_KEY = 'genesys_token';
const ENVIRONMENT_KEY = 'genesys_environment';
const CODE_VERIFIER_KEY = 'pkce_code_verifier';
const REFRESH_TOKEN_KEY = 'genesys_refresh_token';
const TOKEN_EXPIRY_KEY = 'genesys_token_expiry'; // epoch ms en el que el access_token expira
const CLIENT_ID_KEY = 'genesys_client_id';

/**
 * Margen de seguridad (ms) antes de la expiración real para considerar el token
 * "por expirar" y renovarlo de forma proactiva. Evita usar un token que caduca
 * en mitad de una request.
 */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000; // 5 minutos

/** Timeout para esperar la respuesta del popup (ms) */
const POPUP_TIMEOUT_MS = 120_000; // 2 minutos

/** Ruta de la página callback del popup (servida desde /public) */
const POPUP_CALLBACK_PATH = '/auth-popup-callback.html';

// ---------------------------------------------------------------------------
// Helpers PKCE (crypto nativo del browser)
// ---------------------------------------------------------------------------

function generateCodeVerifier(length = 128): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array).slice(0, length);
}

async function computeCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Intercambio de code por token
// ---------------------------------------------------------------------------

/** Respuesta cruda del endpoint /oauth/token de Genesys. */
interface TokenResponse {
  access_token: string;
  token_type?: string;
  /** Segundos hasta que el access_token expire. */
  expires_in?: number;
  /**
   * Token de refresco. Genesys solo lo emite para clientes con Code Authorization
   * (con secret) o cuando se solicita el scope `offline_access`. Con PKCE puro
   * puede no venir — el código maneja ambos casos.
   */
  refresh_token?: string;
  error?: string;
}

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  environment: string,
): Promise<TokenResponse> {
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data: TokenResponse = await response.json();

  if (!data.access_token) {
    throw new Error('No access_token in token response');
  }

  return data;
}

/**
 * Intercambia un refresh_token por un nuevo access_token (grant_type=refresh_token).
 * No requiere popup ni interacción del usuario.
 */
async function exchangeRefreshToken(
  refreshToken: string,
  clientId: string,
  environment: string,
): Promise<TokenResponse> {
  const tokenUrl = `https://login.${environment}/oauth/token`;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const data: TokenResponse = await response.json();

  if (!data.access_token) {
    throw new Error('No access_token in refresh response');
  }

  return data;
}

/**
 * Guarda en localStorage el resultado de un token exchange/refresh.
 * Calcula el timestamp absoluto de expiración a partir de expires_in.
 */
function persistTokenResponse(data: TokenResponse): void {
  localStorage.setItem(TOKEN_KEY, data.access_token);

  if (typeof data.expires_in === 'number' && data.expires_in > 0) {
    const expiryMs = Date.now() + data.expires_in * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryMs));
  } else {
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  if (data.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  }
}

/** true si hay expiración guardada y el token ya caducó (o está dentro del margen). */
function isTokenExpiring(): boolean {
  const expiryRaw = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryRaw) return false;
  const expiryMs = Number(expiryRaw);
  if (!Number.isFinite(expiryMs)) return false;
  return Date.now() >= expiryMs - TOKEN_REFRESH_MARGIN_MS;
}

// ---------------------------------------------------------------------------
// Validar token
// ---------------------------------------------------------------------------

export async function validateToken(
  token: string,
  environment?: string,
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
    },
  );

  if (!response.ok) {
    throw new Error(`Token validation failed with status ${response.status}`);
  }

  const data = await response.json();
  const groupIds: string[] = Array.isArray(data.groups)
    ? data.groups.map((g: { id: string }) => g.id)
    : [];

  return { name: data.name ?? '', id: data.id ?? '', groupIds };
}

// ---------------------------------------------------------------------------
// Popup Auth
// ---------------------------------------------------------------------------

function authenticateViaPopup(authUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'genesys-auth-popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      reject(
        new Error(
          'No se pudo abrir la ventana de autenticación. Verificá que los pop-ups estén habilitados.',
        ),
      );
      return;
    }

    const popupWindow: Window = popup;
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        popupWindow.close();
        reject(new Error('Timeout de autenticación. El usuario no completó el login a tiempo.'));
      }
    }, POPUP_TIMEOUT_MS);

    const pollId = setInterval(() => {
      if (popupWindow.closed && !resolved) {
        resolved = true;
        cleanup();
        reject(new Error('La ventana de autenticación fue cerrada antes de completar el login.'));
      }
    }, 500);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== 'genesys-auth-popup-result') return;

      resolved = true;
      cleanup();
      popupWindow.close();

      if (event.data.error) {
        reject(new Error(`Autorización denegada: ${event.data.error}`));
      } else if (event.data.code) {
        resolve(event.data.code);
      } else {
        reject(new Error('Respuesta inesperada de la ventana de autenticación.'));
      }
    }

    function cleanup() {
      clearTimeout(timeoutId);
      clearInterval(pollId);
      window.removeEventListener('message', handleMessage);
    }

    window.addEventListener('message', handleMessage);
  });
}

// ---------------------------------------------------------------------------
// Función principal: loginWithPKCE
// ---------------------------------------------------------------------------

/** Singleton promise para evitar múltiples flujos concurrentes (React Strict Mode). */
let pendingLogin: Promise<{ name: string; id: string; groupIds: string[]; token: string }> | null = null;

export function loginWithPKCE(
  clientId: string,
  environment: string,
): Promise<{ name: string; id: string; groupIds: string[]; token: string }> {
  if (pendingLogin) return pendingLogin;

  pendingLogin = _doLoginWithPKCE(clientId, environment).finally(() => {
    pendingLogin = null;
  });

  return pendingLogin;
}

async function _doLoginWithPKCE(
  clientId: string,
  environment: string,
): Promise<{ name: string; id: string; groupIds: string[]; token: string }> {
  localStorage.setItem(ENVIRONMENT_KEY, environment);
  localStorage.setItem(CLIENT_ID_KEY, clientId);

  // CASO 1: Hay token guardado
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    // 1a. Si está por expirar y tenemos refresh_token, renovar sin popup.
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken && isTokenExpiring()) {
      try {
        const refreshed = await exchangeRefreshToken(refreshToken, clientId, environment);
        persistTokenResponse(refreshed);
        const userInfo = await validateToken(refreshed.access_token, environment);
        return { ...userInfo, token: refreshed.access_token };
      } catch {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }

    // 1b. Validar el token actual contra el API.
    try {
      const userInfo = await validateToken(storedToken, environment);
      return { ...userInfo, token: storedToken };
    } catch {
      // Token inválido/expirado. Último intento: refresh si aún hay refresh_token.
      const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (rt) {
        try {
          const refreshed = await exchangeRefreshToken(rt, clientId, environment);
          persistTokenResponse(refreshed);
          const userInfo = await validateToken(refreshed.access_token, environment);
          return { ...userInfo, token: refreshed.access_token };
        } catch {
          clearToken();
        }
      } else {
        clearToken();
      }
    }
  }

  // CASO 2: No hay token válido → iniciar flujo PKCE via popup
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await computeCodeChallenge(codeVerifier);

  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

  const popupRedirectUri = `${window.location.origin}${POPUP_CALLBACK_PATH}`;

  const authUrl =
    `https://login.${environment}/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(popupRedirectUri)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}`;

  const authCode = await authenticateViaPopup(authUrl);

  const tokenResponse = await exchangeCodeForToken(
    authCode,
    clientId,
    popupRedirectUri,
    codeVerifier,
    environment,
  );

  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  persistTokenResponse(tokenResponse);

  const userInfo = await validateToken(tokenResponse.access_token, environment);
  return { ...userInfo, token: tokenResponse.access_token };
}

/** Lock para evitar refrescos concurrentes disparados por múltiples requests. */
let refreshInProgress: Promise<string> | null = null;

/**
 * Devuelve un access_token válido, renovándolo con el refresh_token si está por
 * expirar. Úsalo justo antes de llamar a las APIs de Genesys para no quedarte con
 * un token caducado en medio de la sesión.
 */
export async function getValidToken(): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    throw new Error('No hay sesión de Genesys activa.');
  }

  const environment = localStorage.getItem(ENVIRONMENT_KEY);
  const clientId = localStorage.getItem(CLIENT_ID_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken || !environment || !clientId || !isTokenExpiring()) {
    return token;
  }

  if (refreshInProgress) {
    return refreshInProgress;
  }

  refreshInProgress = (async () => {
    try {
      const refreshed = await exchangeRefreshToken(refreshToken, clientId, environment);
      persistTokenResponse(refreshed);
      return refreshed.access_token;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Extract access token from localStorage.
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
 * Remove token from localStorage.
 */
export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ENVIRONMENT_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(CLIENT_ID_KEY);
  }
}
