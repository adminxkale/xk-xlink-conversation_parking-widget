# Documento de Requisitos: Sincronización en Tiempo Real de Interacciones

## Introducción

Este documento define los requisitos para implementar sincronización automática de interacciones en el widget de Conversation Parking, utilizando la Notifications API de Genesys Cloud (WebSocket). Actualmente, el agente debe presionar manualmente el botón "Actualizar interacciones" para ver cambios. Con esta funcionalidad, el widget se actualizará automáticamente cuando las conversaciones del agente cambien de estado en Genesys Cloud, manteniendo las interacciones parqueadas sincronizadas sin intervención manual.

## Glosario

- **Notifications API**: API de Genesys Cloud que permite crear canales WebSocket y suscribirse a topics para recibir eventos en tiempo real.
- **Canal de notificación**: Conexión WebSocket creada contra Genesys Cloud que recibe eventos de los topics suscritos.
- **Topic**: Identificador de un tipo de evento al que se puede suscribir (ej: `v2.users.{userId}.conversations.messages`).
- **Heartbeat**: Mensaje periódico (`channel.metadata`) enviado por Genesys para mantener la conexión activa.
- **Refresh**: Acción de re-obtener las interacciones desde la Xlink API para actualizar la UI.
- **Debounce**: Técnica para agrupar múltiples eventos rápidos en una sola acción, evitando llamadas excesivas.

## Requisitos

### Requisito 1: Establecer conexión WebSocket con Genesys Cloud

**User Story:** Como agente de contact center, quiero que el widget se conecte automáticamente al sistema de notificaciones de Genesys Cloud al autenticarme, para poder recibir actualizaciones en tiempo real sin configuración adicional.

#### Criterios de Aceptación

1. WHEN el agente se autentica exitosamente (token válido + agentId disponible), THE NotificationService SHALL crear un canal de notificación mediante `POST /api/v2/notifications/channels`
2. WHEN el canal es creado exitosamente, THE NotificationService SHALL abrir una conexión WebSocket usando el `connectUri` retornado
3. WHEN la conexión WebSocket se establece, THE NotificationService SHALL suscribirse al topic `v2.users.{agentId}.conversations.messages` mediante `POST /api/v2/notifications/channels/{channelId}/subscriptions`
4. IF la creación del canal o la conexión WebSocket falla, THE NotificationService SHALL reintentar la conexión después de 5 segundos, con un máximo de 3 reintentos

### Requisito 2: Recibir y procesar eventos de conversación

**User Story:** Como agente de contact center, quiero que el widget detecte automáticamente cuando mis conversaciones cambian de estado, para ver siempre información actualizada sin tener que refrescar manualmente.

#### Criterios de Aceptación

1. WHEN un evento de conversación llega por el WebSocket (topic distinto de `channel.metadata`), THE NotificationService SHALL emitir una señal de "conversación actualizada"
2. WHEN se recibe un mensaje de tipo `channel.metadata` (heartbeat), THE NotificationService SHALL ignorarlo sin disparar ninguna acción
3. WHEN se emite una señal de "conversación actualizada", THE Widget SHALL ejecutar un refresh de las interacciones desde la Xlink API
4. WHEN múltiples eventos llegan en un intervalo menor a 2 segundos, THE NotificationService SHALL agruparlos (debounce) y disparar un solo refresh

### Requisito 3: Reconexión automática ante desconexiones

**User Story:** Como agente de contact center, quiero que el widget se reconecte automáticamente si la conexión se pierde, para no perder la sincronización en tiempo real durante mi jornada laboral.

#### Criterios de Aceptación

1. WHEN la conexión WebSocket se cierra inesperadamente, THE NotificationService SHALL intentar reconectarse automáticamente después de 5 segundos
2. WHEN un intento de reconexión falla, THE NotificationService SHALL incrementar el tiempo de espera exponencialmente (5s, 10s, 20s) hasta un máximo de 60 segundos
3. WHEN la reconexión es exitosa, THE NotificationService SHALL re-suscribirse al topic de conversaciones del agente
4. WHEN se alcanza el máximo de reintentos consecutivos (5), THE NotificationService SHALL detenerse y mostrar un indicador visual de "desconectado" en el widget

### Requisito 4: Limpieza de recursos al desmontar

**User Story:** Como agente de contact center, quiero que el widget libere correctamente los recursos de conexión cuando cierro o navego fuera del widget, para no generar conexiones huérfanas ni consumo innecesario.

#### Criterios de Aceptación

1. WHEN el widget se desmonta o el agente cierra sesión, THE NotificationService SHALL cerrar la conexión WebSocket de forma limpia
2. WHEN la conexión se cierra intencionalmente, THE NotificationService SHALL cancelar cualquier timer de reconexión pendiente
3. WHEN el componente se desmonta, THE NotificationService SHALL limpiar todas las suscripciones y listeners de eventos

### Requisito 5: Indicador visual de estado de conexión

**User Story:** Como agente de contact center, quiero ver un indicador sutil del estado de la conexión en tiempo real, para saber si las actualizaciones automáticas están funcionando.

#### Criterios de Aceptación

1. WHEN la conexión WebSocket está activa y suscrita, THE Widget SHALL mostrar un indicador visual de "conectado" (punto verde) junto al botón de refresh
2. WHEN la conexión está intentando reconectarse, THE Widget SHALL mostrar un indicador de "reconectando" (punto amarillo parpadeante)
3. WHEN la conexión ha fallado definitivamente (máximo de reintentos alcanzado), THE Widget SHALL mostrar un indicador de "desconectado" (punto rojo) y el botón de refresh manual seguirá disponible
4. WHEN el indicador está visible, THE Widget SHALL incluir un tooltip con texto descriptivo del estado ("Sincronización activa", "Reconectando...", "Sin conexión en tiempo real")

