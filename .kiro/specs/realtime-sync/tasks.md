# Plan de Implementación: Sincronización en Tiempo Real de Interacciones

## Visión General

Implementar sincronización automática del widget usando la Notifications API de Genesys Cloud (WebSocket). Cuando las conversaciones del agente cambian, el widget re-obtiene las interacciones desde Xlink API automáticamente. El orden de implementación respeta las dependencias: puerto de dominio → servicio de infraestructura → hook de aplicación → componente de presentación → integración con el widget.

## Tareas

- [x] 1. Crear el puerto de dominio NotificationService
  - [x] 1.1 Crear `src/domain/ports/notification-service.port.ts`
    - Definir tipo `ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'`
    - Definir interfaz `NotificationServiceConfig` con: `token`, `agentId`, `environment`, `onConversationUpdate` callback, `onStatusChange` callback
    - Definir interfaz `NotificationService` con métodos: `connect(config)`, `disconnect()`, `getStatus()`
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implementar el servicio GenesysNotificationService
  - [x] 2.1 Crear `src/infrastructure/services/genesys-notification.service.ts`
    - Implementar `connect()`: crear canal via `POST /api/v2/notifications/channels`, abrir WebSocket con `connectUri`, suscribirse al topic `v2.users.{agentId}.conversations.messages`
    - Implementar `handleMessage()`: filtrar heartbeats (`channel.metadata`), emitir `onConversationUpdate` para eventos de conversación
    - Implementar debounce de 2 segundos para agrupar eventos rápidos en un solo callback
    - Implementar `handleClose()`: detectar cierre inesperado y programar reconexión
    - Implementar reconexión con backoff exponencial (5s, 10s, 20s, 40s, 60s max), máximo 5 intentos
    - Implementar `disconnect()`: cerrar WebSocket limpiamente, cancelar timers, limpiar estado
    - Implementar `setStatus()`: actualizar estado interno y notificar via `onStatusChange` callback
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [x] 3. Registrar el servicio en el service registry
  - [x] 3.1 Modificar `src/infrastructure/config/service-registry.ts`
    - Agregar función `getNotificationService()` que retorna una instancia de `GenesysNotificationService`
    - Usar patrón singleton para evitar múltiples instancias del servicio de notificaciones
    - _Requirements: 1.1_

- [x] 4. Implementar el hook useConversationNotifications
  - [x] 4.1 Crear `src/application/hooks/useConversationNotifications.ts`
    - Obtener instancia del servicio via `getNotificationService()`
    - Mantener estado `connectionStatus` con `useState`
    - En `useEffect`: cuando `agentId` y `token` están disponibles, llamar `service.connect()` pasando `onConversationUpdate` (que invoca `onRefresh`) y `onStatusChange` (que actualiza el estado local)
    - En cleanup del `useEffect`: llamar `service.disconnect()`
    - Retornar `{ connectionStatus }`
    - _Requirements: 1.1, 2.3, 4.1, 4.2, 4.3_

- [x] 5. Implementar el componente ConnectionStatusIndicator
  - [x] 5.1 Crear `src/presentation/components/ConnectionStatusIndicator.tsx`
    - Recibir prop `status: ConnectionStatus`
    - Renderizar punto de color según estado:
      - `connected`: `bg-green-500` + tooltip "Sincronización activa"
      - `connecting` / `reconnecting`: `bg-amber-500 animate-pulse` + tooltip "Reconectando..."
      - `disconnected` / `failed`: `bg-red-500` + tooltip "Sin conexión en tiempo real"
    - Tamaño: `w-2.5 h-2.5 rounded-full`
    - Accesibilidad: `aria-label` con el texto del tooltip
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Integrar con ConversationParkingWidget
  - [x] 6.1 Modificar `src/presentation/components/ConversationParkingWidget.tsx`
    - Importar y usar `useConversationNotifications(agent?.id, token, retry)`
    - Pasar `retry` (de `useInteractions`) como callback `onRefresh`
    - Agregar `ConnectionStatusIndicator` junto al botón FAB de refresh
    - Envolver el botón FAB y el indicador en un contenedor flex
    - _Requirements: 2.3, 5.1, 5.2, 5.3_

- [x] 7. Escribir tests unitarios del servicio
  - [x] 7.1 Crear `src/infrastructure/services/genesys-notification.service.test.ts`
    - Test: `connect()` crea canal y abre WebSocket
    - Test: mensajes de conversación disparan `onConversationUpdate` (con debounce)
    - Test: heartbeats (`channel.metadata`) son ignorados
    - Test: múltiples eventos en <2s generan un solo callback
    - Test: cierre inesperado del WebSocket inicia reconexión
    - Test: backoff exponencial incrementa el delay correctamente
    - Test: después de 5 intentos fallidos, status cambia a 'failed'
    - Test: `disconnect()` cierra WebSocket y cancela timers
    - Test: error 401 al crear canal no reintenta (token expirado)
    - Mockear `fetch` y `WebSocket` con implementaciones fake
    - Usar `vi.useFakeTimers()` para controlar timers
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 3.1, 3.2, 3.4_

- [x] 8. Escribir tests del hook y componente
  - [x] 8.1 Crear `src/application/hooks/useConversationNotifications.test.ts`
    - Test: conecta cuando agentId y token están disponibles
    - Test: no conecta si agentId o token son null
    - Test: desconecta al desmontar
    - Test: llama onRefresh cuando llega un evento de conversación
    - Test: expone connectionStatus correctamente
    - _Requirements: 1.1, 2.3, 4.1, 4.2, 4.3_
  - [x] 8.2 Crear `src/presentation/components/ConnectionStatusIndicator.test.tsx`
    - Test: renderiza punto verde para status 'connected'
    - Test: renderiza punto amarillo parpadeante para 'reconnecting'
    - Test: renderiza punto rojo para 'failed'
    - Test: muestra tooltip correcto para cada estado
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Checkpoint final - Verificar integración completa
  - Ejecutar `npm run test` para verificar que todos los tests pasan
  - Ejecutar `npm run build` para verificar que no hay errores de compilación
  - Verificar que el widget compila y el indicador de conexión se renderiza correctamente

## Notas

- Las llamadas a la Notifications API de Genesys se hacen directamente desde el cliente (no necesitan proxy) porque solo usan el Bearer token del agente, sin secretos de Xlink.
- El WebSocket nativo del navegador es suficiente — no se necesita socket.io ni dependencias adicionales.
- El debounce de 2 segundos es crítico para evitar ráfagas de re-fetch cuando Genesys envía múltiples eventos por un solo cambio de conversación.
- Si el token expira, la reconexión fallará con 401 y el servicio se detendrá. El flujo de auth existente manejará la re-autenticación.
- El botón manual de "Actualizar interacciones" sigue disponible como fallback cuando la conexión en tiempo real no está activa.

