/**
 * Genesys Cloud OAuth — Authorization Code Grant with PKCE + Popup Window
 *
 * Siempre usa pop-up window para el login, evitando restricciones de iframe.
 * Compatible con React Strict Mode y Next.js.
 */

const TOKEN_KEY = 'genesys_token';
const ENVIRONMENT_KEY = 'genesys_environment';
const CODE_VERIFIER_KEY = 'pkce_code_verifier';

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

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  environment: string,
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

  // CASO 1: Hay token guardado → validar
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    try {
      const userInfo = await validateToken(storedToken, environment);
      return { ...userInfo, token: storedToken };
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  // CASO 2: No hay token → iniciar flujo PKCE via popup
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

  const token = await exchangeCodeForToken(
    authCode,
    clientId,
    popupRedirectUri,
    codeVerifier,
    environment,
  );

  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  localStorage.setItem(TOKEN_KEY, token);

  const userInfo = await validateToken(token, environment);
  return { ...userInfo, token };
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
  }
}
