---
inclusion: always
---

# Estructura del Proyecto

El proyecto vive en `conversation_parking-widget/` y sigue **Arquitectura Hexagonal** (Puertos y Adaptadores).

## Layout del Código Fuente (`src/`)

```
src/
├── domain/           # Núcleo de negocio — CERO dependencias externas
│   ├── entities/     # Interfaces TypeScript (Interaction, Line, AuthState, Toast, SendTemplateRequest)
│   └── ports/        # Contratos que infraestructura implementa (InteractionService, TemplateService)
├── application/      # Orquestación entre dominio e infraestructura
│   ├── hooks/        # React hooks (useAuth, useInteractions, useAgentLines, useDurationTimer, useToast)
│   └── use-cases/    # Funciones puras de lógica de negocio (consolidateLines, getInteractions, unparkInteraction)
├── infrastructure/   # Integraciones con sistemas externos
│   ├── adapters/     # Funciones puras: respuesta API → entidades de dominio (genesys-auth, lines)
│   ├── services/     # Implementaciones de puertos (RealInteractionService, MockInteractionService, TemplateServiceImpl)
│   └── config/       # Service registry — contenedor DI simple (service-registry.ts)
└── presentation/     # Capa de UI
    ├── components/   # Componentes React funcionales ("use client" solo si requieren interactividad)
    └── providers/    # Context providers (AuthContext, ToastContext)
```

## App Router (`app/`)

```
app/
├── page.tsx                         # Punto de entrada — renderiza el widget
├── layout.tsx                       # Layout raíz
├── globals.css                      # Estilos globales (Tailwind)
├── api/
│   ├── proxy-channels/route.ts      # GET — canales disponibles
│   ├── proxy-conversations/route.ts # GET — conversaciones
│   ├── proxy-group-phones/route.ts  # GET — números telefónicos de un grupo
│   ├── proxy-interactions/route.ts  # GET — interacciones de una línea
│   ├── proxy-interactions/unpark/route.ts  # POST — desparquear interacción
│   └── send-template/route.ts       # POST — enviar mensaje de plantilla
```

## Tests

Dos estrategias de ubicación coexisten:

| Tipo | Ubicación | Ejemplo |
|------|-----------|---------|
| Unitarios co-ubicados | Junto al archivo fuente (`*.test.ts`) | `consolidate-lines.test.ts`, `useAuth.test.ts` |
| Property-based (fast-check) | `__tests__/{capa}/` | `__tests__/api/basic-auth.property.test.ts` |
| Integración | `__tests__/integration/` | `integration.test.tsx` |
| Componentes UI | `__tests__/presentation/` | `ui-components.test.tsx` |

Convención de nombres:
- Tests unitarios: `{nombre}.test.ts(x)`
- Tests de propiedades: `{nombre}.property.test.ts(x)`

## Reglas de Arquitectura

1. **Dominio sin dependencias** — `src/domain/` no importa de `infrastructure/` ni `presentation/`.
2. **Puertos definen contratos** — interfaces en `domain/ports/`; servicios en `infrastructure/services/` las implementan.
3. **Adaptadores son funciones puras** — transforman datos externos a entidades de dominio, sin estado interno ni side effects.
4. **Service registry como DI** — `infrastructure/config/service-registry.ts` exporta funciones getter (`getInteractionService()`, `getTemplateService()`). Para cambiar implementación (mock/real), se modifica solo este archivo.
5. **Rutas API son proxies delgados** — reenvían peticiones a servicios externos, mantienen secretos server-side. No contienen lógica de negocio.
6. **`"use client"` explícito** — solo en componentes que requieren hooks de React o interactividad del navegador.
7. **Hooks de aplicación orquestan** — los hooks en `application/hooks/` conectan UI con use-cases y servicios, nunca acceden directamente a APIs externas.

## Reglas para Crear Archivos Nuevos

| Qué estás creando | Dónde va | Convención |
|-------------------|----------|------------|
| Entidad/modelo de dominio | `src/domain/entities/` | Interface TypeScript, nombre en kebab-case |
| Puerto (contrato de servicio) | `src/domain/ports/` | Interface con sufijo `.port.ts` |
| Implementación de servicio | `src/infrastructure/services/` | Clase que implementa un puerto |
| Adaptador de datos | `src/infrastructure/adapters/` | Funciones puras, sufijo `.adapter.ts` |
| Hook de aplicación | `src/application/hooks/` | Prefijo `use`, camelCase |
| Use case | `src/application/use-cases/` | Función pura, kebab-case |
| Componente React | `src/presentation/components/` | PascalCase, un componente por archivo |
| Context provider | `src/presentation/providers/` | Sufijo `Context.tsx` |
| Ruta API proxy | `app/api/proxy-{recurso}/route.ts` | Prefijo `proxy-` para endpoints que reenvían a APIs externas |
| Test unitario | Junto al archivo fuente | `{nombre}.test.ts(x)` |
| Test de propiedades | `__tests__/{capa}/` | `{nombre}.property.test.ts(x)` |

## Dependencias entre Capas (Dirección Permitida)

```
presentation → application → domain ← infrastructure
                    ↓
              infrastructure
```

- `presentation` importa de `application` y `domain` (solo entities).
- `application` importa de `domain` e `infrastructure/config` (service registry).
- `infrastructure` importa de `domain` (para implementar puertos).
- `domain` NO importa de ninguna otra capa.
