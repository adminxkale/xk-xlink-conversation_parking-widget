# Guía de Migración: Implicit Grant → Authorization Code con PKCE

## Contexto

Genesys Cloud está deprecando el tipo de concesión **Token Implicit Grant (Browser)**. Este documento describe cómo migrar cualquier widget/SPA que use Implicit Grant a **Authorization Code Grant con PKCE**, basado en la implementación realizada en el widget `conversation_parking`.

---

## 1. Cambio en Genesys Cloud Admin

### Pasos:
1. Ir a **Admin → Integrations → OAuth**
2. Buscar la Client Application del widget
3. Cambiar **Grant Type** de `Token Implicit Grant (Browser)` a `Code Authorization`
4. Verificar que el **Authorized Redirect URI** esté configurado correctamente (mismo que antes)
5. Guardar

> **Nota:** El `client_id` no cambia. No se necesita `client_secret` — PKCE lo reemplaza.

---

## 2. Diferencias entre los dos flujos

### Implicit Grant (antes)

```
Widget → Redirige a /oauth/authorize?response_type=token
Genesys → Redirige de vuelta con #access_token=TOKEN_DIRECTO
Widget → Parsea el hash, usa el token
```

### Authorization Code + PKCE (ahora)

```
Widget → Genera code_verifier + code_challenge
Widget → Redirige a /oauth/authorize?response_type=code&code_challenge=HASH
Genesys → Redirige de vuelta con ?code=CODIGO_TEMPORAL
Widget → POST a /oauth/token con code + code_verifier → recibe access_token
Widget → Usa el token
```

---

## 3. Implementación del Adaptador

El adaptador maneja todo el flujo en una sola función `loginWithPKCE()`. Aquí está el código completo reutilizable:

### 3.1 Helpers PKCE (crypto nativo del browser)

```typescript
const TOKEN_KEY = 'genesys_token';
const ENVIRONMENT_KEY = 'genesys_environment';
const CODE_VERIFIER_KEY = 'pkce_code_verifier';

/**
 * Genera un code_verifier random de 128 caracteres.
 * Usa crypto.getRandomValues (disponible en todos los browsers modernos).
 */
function generateCodeVerifier(length = 128): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array).slice(0, length);
}

/**
 * Computa el code_challenge = Base64URL(SHA-256(code_verifier))
 */
async function computeCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL-safe encoding (sin padding, con - y _ en vez de + y /)
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
```

### 3.2 Función principal: `loginWithPKCE`

```typescript
export async function loginWithPKCE(
  clientId: string,
  environment: string
): Promise<{ name: string; id: string; groupIds: string[]; token: string }> {
  localStorage.setItem(ENVIRONMENT_KEY, environment);

  const redirectUri = window.location.origin + window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');

  // --- CASO 1: Estamos en el callback (URL tiene ?code=) ---
  if (authCode) {
    const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      throw new Error('No se encontró el code_verifier.');
    }

    sessionStorage.removeItem(CODE_VERIFIER_KEY);

    // Intercambiar code por token
    const token = await exchangeCodeForToken(
      authCode, clientId, redirectUri, codeVerifier, environment
    );

    localStorage.setItem(TOKEN_KEY, token);

    // Limpiar URL
    window.history.replaceState(null, '', redirectUri);

    // Obtener info del usuario
    const userInfo = await validateToken(token, environment);
    return { ...userInfo, token };
  }

  // --- CASO 2: Hay token guardado → validar ---
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    try {
      const userInfo = await validateToken(storedToken, environment);
      return { ...userInfo, token: storedToken };
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  // --- CASO 3: No hay token → iniciar flujo PKCE ---
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await computeCodeChallenge(codeVerifier);

  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

  const authUrl =
    `https://login.${environment}/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}`;

  window.location.href = authUrl;

  // La página navega — esta promesa nunca se resuelve
  return new Promise(() => {});
}
```

### 3.3 Intercambio de code por token

```typescript
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
```

### 3.4 Validar token (sin cambios respecto a Implicit Grant)

```typescript
export async function validateToken(
  token: string,
  environment: string
): Promise<{ name: string; id: string; groupIds: string[] }> {
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
  const groupIds = Array.isArray(data.groups)
    ? data.groups.map((g: { id: string }) => g.id)
    : [];

  return { name: data.name ?? '', id: data.id ?? '', groupIds };
}
```

---

## 4. Almacenamiento

| Clave | Storage | Propósito |
|-------|---------|-----------|
| `genesys_token` | localStorage | Token de acceso (persiste entre recargas) |
| `genesys_environment` | localStorage | Dominio de Genesys (mypurecloud.com, etc.) |
| `pkce_code_verifier` | sessionStorage | Code verifier temporal (se borra tras el intercambio) |

---

## 5. Cambios necesarios en el código del widget

### 5.1 Lo que se elimina

- ❌ Función `extractToken()` que parsea `#access_token=` de la URL hash
- ❌ Función `redirectToLogin()` con `response_type=token`
- ❌ Lógica de prevención de loops con `auth_redirect_pending` en sessionStorage
- ❌ Dependencia `purecloud-platform-client-v2` (si se usaba solo para auth)

### 5.2 Lo que se agrega

- ✅ Función `loginWithPKCE()` (reemplaza extract + validate + redirect)
- ✅ Helpers PKCE: `generateCodeVerifier`, `computeCodeChallenge`, `base64UrlEncode`
- ✅ Función `exchangeCodeForToken()` (POST a /oauth/token)

### 5.3 Lo que NO cambia

- El token resultante es el mismo tipo (`Bearer` token para APIs de Genesys)
- `validateToken()` sigue igual (GET /api/v2/users/me)
- `clearToken()` sigue igual (borra de localStorage)
- El `AuthState` / context no cambia
- Los componentes que consumen el token no necesitan cambios
- Los servicios que usan el token (notifications, proxies) no necesitan cambios

---

## 6. Hook de autenticación (simplificado)

```typescript
export function useAuth(credentials: GenesysCredentials | null): AuthState {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;

    async function authenticate() {
      try {
        const { name, id, groupIds, token } = await loginWithPKCE(
          credentials!.genesys_client_id,
          credentials!.environment
        );

        if (cancelled) return;

        setState({
          isAuthenticated: true,
          isLoading: false,
          token,
          agent: { name, id },
          agentGroupIds: groupIds,
          tenantId: null,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        clearToken();
        setState({
          isAuthenticated: false,
          isLoading: false,
          token: null,
          agent: null,
          agentGroupIds: null,
          tenantId: null,
          error: err instanceof Error ? err.message : 'Authentication failed',
        });
      }
    }

    authenticate();
    return () => { cancelled = true; };
  }, [credentials]);

  return state;
}
```

---

## 7. Dependencias requeridas

**Ninguna adicional.** La implementación usa solo APIs nativas del browser:
- `crypto.getRandomValues()` — generación de random
- `crypto.subtle.digest()` — SHA-256
- `btoa()` — Base64 encoding
- `fetch()` — HTTP requests
- `URLSearchParams` — parseo de query params
- `sessionStorage` / `localStorage` — persistencia

---

## 8. Compatibilidad de browsers

Las APIs crypto usadas están disponibles en:
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 12+

> **Nota:** `crypto.subtle` requiere contexto seguro (HTTPS o localhost). En producción esto no es un problema. En desarrollo local, `localhost` cuenta como seguro.

---

## 9. Checklist de migración

- [ ] Cambiar Grant Type en Genesys Cloud Admin a "Code Authorization"
- [ ] Verificar que el Redirect URI esté configurado correctamente
- [ ] Reemplazar las funciones de auth (extractToken del hash, redirectToLogin con response_type=token)
- [ ] Agregar las funciones PKCE (generateCodeVerifier, computeCodeChallenge, exchangeCodeForToken)
- [ ] Implementar `loginWithPKCE()` como función principal de auth
- [ ] Actualizar el hook de auth para usar `loginWithPKCE()`
- [ ] Verificar que el token sigue llegando a todos los servicios que lo usan
- [ ] Probar el flujo completo (primera visita → login → callback → uso del token)
- [ ] Eliminar dependencia `purecloud-platform-client-v2` si solo se usaba para auth
- [ ] Limpiar código legacy (funciones deprecated de Implicit Grant)

---

## 10. Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `No se encontró el code_verifier` | sessionStorage se perdió entre redirect | Verificar que el redirect URI sea exactamente el mismo origen/path |
| `Token exchange failed (400)` | code_verifier no coincide con code_challenge | Verificar que no se esté regenerando el verifier en el callback |
| `Token exchange failed (401)` | Client App no está configurada como Code Authorization | Cambiar Grant Type en Genesys Admin |
| `CORS error en POST /oauth/token` | El dominio no está en allowed origins | Verificar Redirect URI en la Client App de Genesys |
| `Token validation failed (401)` | Token expirado | El flujo ya maneja esto — borra el token y reinicia PKCE |

---

## 11. Seguridad: ¿Por qué PKCE es mejor que Implicit?

| Riesgo | Implicit Grant | PKCE |
|--------|---------------|------|
| Token expuesto en URL | ✅ Sí (#access_token en hash) | ❌ No (solo un code temporal) |
| Token en historial del browser | ✅ Sí | ❌ No |
| Token interceptable por extensiones | ✅ Sí (leen la URL) | ❌ No |
| Replay attack del code | N/A | ❌ No (code_verifier es single-use) |
| Man-in-the-middle del code | N/A | ❌ No (sin el verifier, el code es inútil) |
