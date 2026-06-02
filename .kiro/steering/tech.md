---
inclusion: always
---

# Stack Tecnológico

## Framework y Runtime

- **Next.js 16.2** — App Router (no Pages Router)
- **React 19** — componentes funcionales, hooks
- **TypeScript 5** — modo estricto (`"strict": true`), target ES2017, module resolution `bundler`
- **Tailwind CSS 4** — estilos vía utility classes, configurado con `@tailwindcss/postcss`

## Testing

- **Vitest 4** — test runner, entorno `jsdom`, globals habilitados
- **@testing-library/react 16** + **@testing-library/jest-dom** — tests de componentes
- **@testing-library/user-event** — simulación de interacciones de usuario
- **fast-check 4** — property-based testing
- **msw 2** — mocking de APIs HTTP en tests
- Setup global: `vitest.setup.ts` importa `@testing-library/jest-dom`
- Plugin: `@vitejs/plugin-react` para soporte JSX en tests

## Linting

- **ESLint 9** con `eslint-config-next` (core-web-vitals + typescript)
- Sin reglas custom adicionales — se usan los defaults de Next.js

## Comandos

Todos se ejecutan desde `conversation_parking-widget/`:

```bash
npm run dev      # Servidor de desarrollo (localhost:3000)
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # ESLint
npm run test     # vitest --run (ejecución única, sin watch)
```

> **Importante:** Usar siempre `npm run test` (no `vitest` directo) para respetar la configuración del proyecto.

## Alias de Rutas

`@/*` → raíz del proyecto (`./`). Configurado en `tsconfig.json` y `vitest.config.ts`.

Ejemplo: `import { Interaction } from '@/src/domain/entities/interaction'`

## Convenciones de Código

- Funciones y variables: `camelCase`
- Componentes React: `PascalCase`
- Archivos: `kebab-case` para módulos de dominio/infraestructura, `PascalCase` para componentes React
- Interfaces sobre types cuando definen contratos
- `"use client"` explícito solo en componentes que usan hooks de React o APIs del navegador
- No usar `any` — preferir tipos explícitos o `unknown` con narrowing
- Imports con alias `@/` en lugar de rutas relativas largas

## Integraciones Externas

| Servicio | Propósito | Autenticación |
|----------|-----------|---------------|
| Genesys Cloud | OAuth, datos de agentes y grupos | Bearer token (Implicit Grant) |
| Xlink API | Canales, interacciones, plantillas | Basic Auth (server-side) |

- Todas las llamadas a APIs externas pasan por rutas proxy de Next.js (`/api/proxy-*`)
- Los secretos de Xlink API se mantienen exclusivamente en el servidor (variables de entorno sin `NEXT_PUBLIC_`)
- Las variables `NEXT_PUBLIC_*` son solo para configuración del cliente OAuth (client ID, environment)

## Reglas para Dependencias

- No agregar dependencias sin justificación — el proyecto es intencionalmente ligero
- Usar versiones exactas o rangos `^` (ya establecido en package.json)
- No instalar librerías de UI (Material UI, Chakra, etc.) — se usa Tailwind CSS directamente
- No instalar librerías de state management (Redux, Zustand) — se usan hooks + Context de React
