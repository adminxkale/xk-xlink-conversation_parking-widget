---
inclusion: always
---

# Producto: Conversation Parking Widget

Widget web embebido para gestionar interacciones de mensajería (WhatsApp) en un contact center. Se integra con Genesys Cloud (autenticación, grupos de agentes) y Xlink API (canales, interacciones, plantillas).

## Funcionalidad Principal

- Listar interacciones de mensajería activas para las líneas del agente autenticado
- Parquear y desparquear conversaciones (retener/reanudar)
- Filtrar interacciones por línea de origen
- Enviar mensajes de plantilla a conversaciones parqueadas para re-enganchar al cliente
- Mostrar duración en tiempo real de conversaciones activas
- Refrescar manualmente la lista de interacciones

## Modelo de Dominio

| Entidad | Descripción | Campos clave |
|---------|-------------|--------------|
| `Interaction` | Conversación de mensajería entre agente y cliente | `id`, `originLine`, `destinationLine`, `startTimestamp` (ISO 8601), `isParked`, `clientName?`, `agentId?`, `agentName?`, `queueId?` |
| `Line` | Número telefónico asociado a un grupo de agentes | `id`, `number`, `phone_number_id`, `phone_number`, `groups?` |
| `SendTemplateRequest` | Solicitud para enviar plantilla | `destinationLine`, `conversationId` |

## Operaciones del Dominio

- `getInteractions(agentId?)` — Obtener interacciones (opcionalmente filtradas por agente)
- `unparkInteraction(params)` — Desparquear una conversación, requiere: id, business, client, agentId, agentName, queueId, token
- `sendTemplate(request)` — Enviar mensaje de plantilla a una conversación

## Flujo de Usuario

1. El agente accede al widget → se autentica vía OAuth con Genesys Cloud
2. Se cargan las líneas asociadas a los grupos del agente
3. Se muestran las interacciones activas (parqueadas y no parqueadas)
4. El agente puede filtrar por línea, desparquear conversaciones o enviar plantillas
5. Un botón flotante permite refrescar la lista manualmente

## Convenciones de UI

- Idioma de la interfaz: **español** (etiquetas como "Parqueada", "Activa", "Líneas", "Actualizar interacciones")
- Título del widget: "Conversation Parking Hub"
- Logo: Xlink (`/images/xlink_logo_v2.png`)
- Estilo visual: fondo blanco, bordes grises, botones azules (Tailwind utilities)
- Notificaciones: sistema de toasts para feedback de acciones (éxito/error)
- Estados de carga: spinners y disabled states en botones durante operaciones async

## Reglas de Producto

1. El widget es una SPA embebida — no tiene navegación multi-página.
2. Todas las llamadas a APIs externas pasan por rutas proxy de Next.js (`/api/proxy-*`) para mantener secretos en el servidor.
3. Las interacciones se filtran en el cliente por `originLine` comparando con `line.phone_number`.
4. El desparqueo requiere token de Genesys y datos del agente autenticado.
5. Los mensajes de plantilla solo se envían a conversaciones parqueadas.
6. No hay persistencia local de interacciones — siempre se obtienen del servidor.
