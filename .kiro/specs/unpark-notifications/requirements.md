# Documento de Requisitos: Notificaciones de Resultado al Desparquear Conversación

## Introducción

Este documento define los requisitos para agregar notificaciones tipo toast al widget de Conversation Parking, proporcionando feedback visual al usuario cuando la acción de desparquear una conversación se completa exitosamente o falla. Actualmente, el éxito se maneja silenciosamente y los errores se muestran como errores generales de la lista, lo cual no comunica claramente el resultado de la acción específica al usuario.

## Glosario

- **Toast**: Componente de notificación temporal que aparece superpuesto en la interfaz, se auto-oculta después de un tiempo determinado y no bloquea la interacción del usuario con el resto del widget.
- **Widget**: El componente `ConversationParkingWidget`, punto de entrada principal de la interfaz de usuario.
- **Unpark**: Acción de desparquear una conversación previamente parqueada, cambiando su estado de "Parqueada" a "Activa".
- **Toast_Container**: Contenedor de presentación que gestiona la posición y el apilamiento de múltiples toasts visibles simultáneamente.
- **Toast_Manager**: Módulo de lógica de aplicación responsable de gestionar el ciclo de vida de las notificaciones toast (crear, programar auto-ocultamiento, eliminar).

## Requisitos

### Requisito 1: Mostrar notificación de éxito al desparquear

**User Story:** Como agente de contact center, quiero ver una confirmación visual cuando desparqueo una conversación exitosamente, para tener certeza de que la acción se completó.

#### Criterios de Aceptación

1. WHEN la operación de unpark se completa exitosamente, THE Toast_Manager SHALL crear un toast de tipo éxito con el mensaje "Conversación desparqueada exitosamente"
2. WHEN un toast de éxito es creado, THE Toast_Container SHALL renderizar el toast con estilo visual que indique éxito (fondo verde)
3. WHEN un toast de éxito es visible, THE Toast_Container SHALL posicionar el toast de forma que no obstruya los controles principales del widget

### Requisito 2: Mostrar notificación de error al fallar el unpark

**User Story:** Como agente de contact center, quiero ver un mensaje de error específico cuando el desparqueo falla, para entender qué ocurrió y decidir si reintentar.

#### Criterios de Aceptación

1. WHEN la operación de unpark falla, THE Toast_Manager SHALL crear un toast de tipo error con el mensaje de error específico retornado por el servicio
2. WHEN un toast de error es creado, THE Toast_Container SHALL renderizar el toast con estilo visual que indique error (fondo rojo)
3. IF el servicio no retorna un mensaje de error específico, THEN THE Toast_Manager SHALL usar el mensaje por defecto "No se pudo desparquear la conversación. Intenta de nuevo."

### Requisito 3: Auto-ocultamiento de notificaciones

**User Story:** Como agente de contact center, quiero que las notificaciones desaparezcan automáticamente, para no tener que cerrarlas manualmente y poder continuar trabajando sin interrupciones.

#### Criterios de Aceptación

1. WHEN un toast es mostrado, THE Toast_Manager SHALL programar su eliminación automática después de 5 segundos
2. WHEN el tiempo de auto-ocultamiento se cumple, THE Toast_Container SHALL remover el toast de la interfaz
3. WHEN un toast es visible, THE Toast_Container SHALL mostrar un botón de cierre manual para que el usuario pueda descartarlo antes del auto-ocultamiento

### Requisito 4: No bloqueo de la interfaz

**User Story:** Como agente de contact center, quiero poder seguir interactuando con el widget mientras las notificaciones están visibles, para no perder productividad.

#### Criterios de Aceptación

1. WHILE un toast es visible, THE Widget SHALL mantener todos sus controles interactivos y funcionales
2. WHILE un toast es visible, THE Toast_Container SHALL renderizar el toast en una capa superpuesta que no intercepte eventos de los elementos subyacentes
3. WHEN múltiples operaciones de unpark generan toasts simultáneamente, THE Toast_Container SHALL apilar los toasts visibles sin solaparse entre sí

### Requisito 5: Desacoplamiento del error general

**User Story:** Como agente de contact center, quiero que los errores de unpark se muestren como notificaciones toast en lugar de reemplazar toda la lista de interacciones, para no perder visibilidad de mis conversaciones activas.

#### Criterios de Aceptación

1. WHEN la operación de unpark falla, THE Widget SHALL mostrar el error exclusivamente mediante un toast, sin modificar el estado de error general de la lista de interacciones
2. WHEN un error de unpark se muestra como toast, THE InteractionList SHALL permanecer visible con su contenido actual intacto
