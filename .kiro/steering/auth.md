# Autenticación y Login

## Flujo de Autenticación

El widget usa **OAuth 2.0 Implicit Grant** contra Genesys Cloud. No hay pantalla de login propia — el usuario es redirigido a Genesys Cloud para autenticarse y regresa con un `access_token` en el hash de la URL.

### Secuencia del flujo

1. El usuario accede al widget.
2. `useAuth` (hook) se ejecuta al montar el componente raíz.
3. `extractToken()` busca un token en este orden de prioridad:
   - URL hash (`#access_token=xxx`) — resultado del redirect OAuth
   - URL query params (`?access_token=xxx`)
   - `localStorage` (clave: `genesys_token`)
4. Si no hay token → se redirige a la página de login de Genesys Cloud (`redirectToLogin()`).
5. Si hay token → se valida contra `GET /api/v2/users/me?expand=groups` en Genesys Cloud.
6. Si la validación es exitosa → se almacena el estado autenticado con nombre, id y groupIds del agente.
7. Si la validación falla → se limpia el token y se muestra un error (sin redirigir, para evitar loops).

### Prevención de loops de redirect

Se usa `sessionStorage` con la clave `auth_redirect_pending`:
- Se setea antes de redirigir al login.
- Si al volver no hay token y la flag existe, se muestra error en vez de redirigir de nuevo.

## Archivos Involucrados

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| Dominio | `src/domain/entities/auth.ts` | Interface `AuthState` |
| Infraestructura | `src/infrastructure/adapters/genesys-auth.adapter.ts` | Funciones puras: `extractToken`, `validateToken`, `redirectToLogin`, `clearToken` |
| Aplicación | `src/application/hooks/useAuth.ts` | Hook que orquesta el flujo completo de autenticación |
| Presentación | `src/presentation/providers/AuthContext.tsx` | Context de React para compartir el estado de auth |
| Presentación | `src/presentation/components/AuthProvider.tsx` | Provider que ejecuta `useAuth` y maneja estados de loading/error |

## Variables de Entorno Requeridas

```
NEXT_PUBLIC_GENESYS_CLIENT_ID    # Client ID de la app OAuth en Genesys Cloud
NEXT_PUBLIC_GENESYS_ENVIRONMENT  # Dominio de Genesys (ej: mypurecloud.com)
```

Ambas son públicas (`NEXT_PUBLIC_`) porque el flujo Implicit Grant se ejecuta en el navegador.

## Interface AuthState

```typescript
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  agent: { name: string; id: string } | null;
  agentGroupIds: string[] | null;
  error: string | null;
}
```

## Almacenamiento del Token

- **localStorage** (clave `genesys_token`): Persiste el token entre recargas.
- Al extraer el token de la URL, se limpia el hash/query para evitar reprocesamiento.
- `clearToken()` elimina el token de localStorage cuando la validación falla.

## Endpoint de Validación

```
GET https://api.{environment}/api/v2/users/me?expand=groups
Authorization: Bearer {token}
```

Retorna: `{ name, id, groups: [{ id }] }`

## Comportamiento del AuthProvider

- **Loading**: Muestra spinner con texto "Autenticando..."
- **Error**: Muestra mensaje de error + botón "Reintentar" (recarga la página)
- **Autenticado**: Renderiza los children envueltos en `AuthContext.Provider`

## Reglas para Modificaciones

1. **No agregar pantalla de login propia** — el login lo maneja Genesys Cloud.
2. **No cambiar a Authorization Code Grant** — el widget corre como SPA embebida, no tiene backend propio para intercambiar codes.
3. **Mantener la prevención de loops** — siempre verificar `auth_redirect_pending` antes de redirigir.
4. **El adaptador debe ser puro** — `genesys-auth.adapter.ts` no debe tener estado interno ni side effects más allá de localStorage y URL.
5. **Los tests mockean el adaptador** — `useAuth.test.ts` mockea todo el módulo del adaptador para testear el hook en aislamiento.
6. **No exponer tokens en logs de producción** — los `console.log` actuales son para desarrollo; en producción deben eliminarse o condicionarse.

## Testing

- Tests unitarios del adaptador: `src/infrastructure/adapters/genesys-auth.adapter.test.ts`
- Tests del hook: `src/application/hooks/useAuth.test.ts`
- Property-based tests de auth: `__tests__/api/basic-auth.property.test.ts` (para Basic Auth de Xlink, no OAuth)
