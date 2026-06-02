# Diseño Visual — Estándar para Widgets Xlink

Guía genérica de diseño aplicable a todos los widgets embebidos de la plataforma Xlink. Define paleta de colores, tipografía, espaciado, componentes y patrones de interacción para mantener coherencia visual entre productos.

## Filosofía de Diseño

- **Estilo**: Flat Design con toques de elevación sutil (shadow-sm/md). Limpio, profesional, orientado a productividad.
- **Densidad**: Compacta pero legible — los widgets se embeben en interfaces de contact center donde el espacio es limitado.
- **Tono visual**: Neutral y funcional. La UI no compite con el contenido; lo presenta con claridad.
- **Plataforma**: Web (SPA embebida), optimizada para viewports reducidos (paneles laterales, iframes).

## Paleta de Colores

### Colores Base (Superficies)

| Token | Valor Tailwind | Uso |
|-------|---------------|-----|
| `surface-primary` | `bg-white` | Fondo principal del widget |
| `surface-secondary` | `bg-gray-50` | Secciones alternadas, fondos de listas |
| `border-default` | `border-gray-200` | Bordes de cards, separadores, inputs |
| `border-strong` | `border-gray-300` | Bordes de inputs con foco, separadores prominentes |

### Colores de Texto

| Token | Valor Tailwind | Uso |
|-------|---------------|-----|
| `text-primary` | `text-gray-900` | Títulos, texto principal |
| `text-secondary` | `text-gray-700` | Texto de soporte, descripciones |
| `text-muted` | `text-gray-500` | Metadatos, timestamps, placeholders |
| `text-inverse` | `text-white` | Texto sobre fondos de color (botones) |

### Colores de Acción (Brand)

| Token | Valor Tailwind | Uso |
|-------|---------------|-----|
| `action-primary` | `bg-blue-600` | Botones primarios, FABs, links activos |
| `action-primary-hover` | `hover:bg-blue-700` | Estado hover de acciones primarias |
| `action-primary-active` | `active:bg-blue-800` | Estado pressed |
| `action-primary-focus` | `focus:ring-blue-500` | Anillo de foco |

### Colores Semánticos (Feedback)

| Estado | Fondo | Borde | Texto | Uso |
|--------|-------|-------|-------|-----|
| Éxito | `bg-green-50` | `border-green-500` | `text-green-800` | Confirmaciones, estados activos |
| Advertencia | `bg-amber-50` | `border-amber-200` | `text-amber-800` | Estados pendientes, alertas leves |
| Error | `bg-red-50` | `border-red-500` | `text-red-800` | Errores, estados críticos |
| Info | `bg-blue-50` | `border-blue-200` | `text-blue-800` | Información contextual |

### Colores de Estado (Badges/Pills)

| Estado | Clases | Ejemplo |
|--------|--------|---------|
| Activo/Positivo | `bg-green-100 text-green-800` | Badge "Activa" |
| Pendiente/Parqueado | `bg-amber-100 text-amber-800` | Badge "Parqueada" |
| Error/Expirado | `bg-red-100 text-red-800` | Badge "Expirada" |
| Neutral/Info | `bg-blue-100 text-blue-800` | Badge informativo |

## Tipografía

| Elemento | Clases Tailwind | Notas |
|----------|----------------|-------|
| Título del widget (h1) | `text-lg font-semibold text-gray-900` | Único por widget |
| Subtítulo/sección | `text-sm font-medium text-gray-900` | Encabezados de sección |
| Texto de cuerpo | `text-sm text-gray-700` | Contenido principal |
| Metadatos | `text-xs text-gray-500` | Timestamps, IDs, datos secundarios |
| Monospace (timers) | `text-xs font-mono` | Contadores, duraciones |
| Labels de formulario | `text-sm font-medium text-gray-700` | Siempre visibles (no solo placeholder) |

### Reglas Tipográficas

- Font family base: `font-family: Arial, Helvetica, sans-serif` (definido en globals.css).
- No usar fuentes custom ni Google Fonts — los widgets deben cargar rápido sin dependencias externas.
- Tamaño mínimo de texto: `text-xs` (12px). Nunca menor.
- Line-height: usar defaults de Tailwind (1.5 para body, 1.25 para headings).
- Truncar con `truncate` cuando el espacio es limitado; proveer tooltip o expand para texto completo.

## Espaciado y Layout

### Sistema de Espaciado

Usar escala de 4px (Tailwind default): `1` = 4px, `2` = 8px, `3` = 12px, `4` = 16px, `6` = 24px, `8` = 32px.

| Contexto | Padding | Gap |
|----------|---------|-----|
| Widget container | `p-0` (full bleed) | — |
| Header | `p-4` | `gap-3` |
| Secciones internas | `p-3` | `gap-2` |
| Cards | `p-4` | `gap-2` entre elementos internos |
| Lista de items | — | `gap-3` entre cards |
| Botones | `px-3 py-2` (sm) / `px-4 py-2` (md) | — |

### Layout del Widget

```
┌─────────────────────────────┐
│ Header (logo + título)      │  ← fixed top, border-b
├─────────────────────────────┤
│ Controles (filtros, select) │  ← sticky o static
├─────────────────────────────┤
│                             │
│ Contenido scrollable        │  ← flex-1 overflow-y-auto
│ (lista de cards)            │
│                             │
└─────────────────────────────┘
  [FAB]                          ← fixed bottom-right
```

- El widget ocupa `h-full` del contenedor padre.
- Estructura: `flex flex-col h-full`.
- Área de contenido: `flex-1 overflow-y-auto`.
- Elementos flotantes (FAB): `fixed bottom-4 right-4 z-40`.

## Componentes — Patrones Visuales

### Botones

| Variante | Clases |
|----------|--------|
| Primario | `px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500` |
| Éxito (acción positiva) | `px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-green-500` |
| Destructivo | `px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-red-500` |
| Disabled | Agregar `disabled:opacity-50 disabled:cursor-not-allowed` |
| FAB (floating) | `w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg` |

### Reglas de Botones

- Tamaño mínimo touch target: `min-w-[44px] min-h-[44px]`.
- Siempre incluir `focus:outline-none focus:ring-2 focus:ring-offset-1`.
- Mostrar spinner o texto "..." durante operaciones async (`disabled` + indicador visual).
- Un solo botón primario por vista. Acciones secundarias usan variantes menos prominentes.

### Cards

```
rounded-lg border p-4 transition-colors duration-200
```

- Usar color de fondo semántico según estado (green-50 activo, amber-50 pendiente).
- Borde del mismo tono que el fondo (`border-green-200`, `border-amber-200`).
- No usar sombras en cards dentro de listas — reservar `shadow` para elementos flotantes.

### Inputs y Selects

```
w-full p-2 text-sm border rounded-lg bg-white border-gray-300 text-gray-900
focus:ring-2 focus:ring-blue-500 min-h-[44px]
```

- Siempre incluir `<label>` visible o `sr-only` + `aria-label`.
- Altura mínima: `min-h-[44px]` para touch targets.
- Focus ring: `focus:ring-2 focus:ring-blue-500`.

### Toasts / Notificaciones

- Posición: esquina superior derecha o inferior derecha del widget.
- Estilo: `border-l-4` con color semántico + fondo tenue.
- Auto-dismiss: 3-5 segundos.
- Animación de entrada: slide-in desde la derecha (300ms ease-out).
- Incluir botón de dismiss y `role="alert"` + `aria-live="assertive"`.
- No bloquear interacción del usuario.

### Estados Vacíos

- Centrado vertical y horizontal: `flex flex-col items-center gap-3 p-8`.
- Texto descriptivo en `text-gray-500`.
- Botón de acción opcional (recargar, crear, etc.).

### Estados de Carga

- Texto simple: "Cargando..." en `text-sm text-gray-500`.
- Spinners: usar `animate-spin` en SVG icons.
- Botones durante carga: `disabled` + spinner inline.

### Estados de Error

- Texto en `text-red-600` con `role="alert"`.
- Siempre ofrecer acción de recuperación (botón "Reintentar").
- No usar modales para errores — mostrar inline.

## Iconografía

- **Fuente de iconos**: SVG inline con `stroke="currentColor"` y `strokeWidth={2}`.
- **Estilo**: Outline (línea), consistente con Heroicons o Lucide.
- **Tamaños estándar**: `w-4 h-4` (sm), `w-5 h-5` (md), `w-6 h-6` (lg).
- **Accesibilidad**: `aria-hidden="true"` en iconos decorativos. `aria-label` en iconos funcionales sin texto.
- **NO usar emojis como iconos estructurales** — solo como contenido de datos si es relevante.

## Animaciones y Transiciones

| Tipo | Duración | Easing | Uso |
|------|----------|--------|-----|
| Hover/focus en botones | 200ms | `transition-colors duration-200` | Cambio de color |
| Entrada de toasts | 300ms | `ease-out` | Slide-in |
| Spinner de carga | continuo | `animate-spin` | Indicador de proceso |

### Reglas de Animación

- Máximo 300ms para micro-interacciones.
- Solo animar `transform` y `opacity` para performance.
- Respetar `prefers-reduced-motion` (no implementado aún, pero considerar en futuras iteraciones).
- No animar entrada de cards en listas — aparecen inmediatamente.

## Accesibilidad

### Contraste

- Texto principal sobre fondo blanco: ratio ≥ 4.5:1 (gray-900 sobre white = ✓).
- Texto secundario: ratio ≥ 4.5:1 (gray-700 sobre white = ✓).
- Texto muted: ratio ≥ 3:1 mínimo (gray-500 sobre white = borderline, aceptable para metadatos no críticos).

### Interacción

- Todos los elementos interactivos tienen `focus:ring-2` visible.
- Touch targets mínimo `44×44px` (`min-w-[44px] min-h-[44px]`).
- No depender solo del color para transmitir estado — combinar con texto o icono.
- Labels en todos los inputs (visibles o `sr-only`).
- `role="alert"` en mensajes de error y toasts.

### Navegación por Teclado

- Tab order sigue el orden visual.
- Botones y links son focusables por defecto.
- No usar `outline-none` sin proveer `focus:ring` alternativo.

## Responsive y Embebido

- Los widgets se diseñan para **viewports pequeños** (300-400px de ancho típico en paneles laterales).
- No usar breakpoints de Tailwind (`sm:`, `md:`) salvo que el widget se use también a pantalla completa.
- Texto y controles deben ser legibles sin zoom en el viewport mínimo.
- Evitar scroll horizontal — todo el contenido fluye verticalmente.
- Usar `truncate` en textos largos (nombres, números de teléfono).

## Anti-Patrones (NO Hacer)

| ❌ No hacer | ✅ Hacer en su lugar |
|-------------|---------------------|
| Usar librerías de UI (MUI, Chakra, Ant) | Tailwind CSS directo |
| Agregar fuentes custom o Google Fonts | Arial/Helvetica/sans-serif del sistema |
| Sombras pesadas en cards de lista | Bordes sutiles con color semántico |
| Modales para confirmaciones simples | Toasts o feedback inline |
| Iconos como emojis | SVG inline con stroke |
| Colores hardcodeados (hex en className) | Tokens semánticos de Tailwind |
| Animaciones > 500ms | Máximo 300ms para micro-interacciones |
| Texto menor a 12px | Mínimo `text-xs` (12px) |
| Botones sin estado disabled durante async | Siempre `disabled` + indicador visual |
| Placeholder como único label | Label visible o sr-only + aria-label |

## Branding

- **Logo**: Xlink (`/images/xlink_logo_v2.png`), altura `h-8`, ancho auto.
- **Posición del logo**: Header, alineado a la izquierda junto al título.
- **Nombre del producto**: Junto al logo en `text-lg font-semibold text-gray-900`.
- **No agregar más elementos de branding** — el widget es una herramienta, no una landing page.

## Idioma de la Interfaz

- Todos los textos visibles al usuario en **español**.
- Labels de accesibilidad (`aria-label`) también en español.
- Nombres técnicos en código (variables, props, clases) en **inglés**.
