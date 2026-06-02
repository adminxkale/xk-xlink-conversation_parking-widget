# Documento de Requisitos — Conversation Parking Widget

## Introducción

Widget embebido para Genesys Cloud que permite a los agentes de un centro de contacto visualizar todas las interacciones abiertas y controlar el estado de parqueo de cada conversación. Cuando un agente desparquea una conversación, el sistema envía automáticamente una plantilla al número de destino a través de una API proxy. La aplicación se construye con Next.js 16 (App Router), React 19, Tailwind CSS 4 y TypeScript, y se ejecuta dentro del contexto de un widget de Genesys Cloud.

## Glosario

- **Xlink**: Producto principal bajo el cual se enmarca este widget. Su logotipo (`xlink_logo_v2.png`) se encuentra en `/images/xlink_logo_v2.png` y debe mostrarse en la cabecera del widget.
- **Widget**: Aplicación web embebida dentro de la interfaz de Genesys Cloud que los agentes utilizan durante su operación diaria, identificada visualmente como parte del producto Xlink.
- **Interacción**: Conversación activa entre un agente y un cliente dentro de Genesys Cloud, identificada por un ID único.
- **Tarjeta_de_Interacción**: Componente visual horizontal que muestra la información resumida de una interacción (línea de origen, línea de destino, duración y estado de parqueo).
- **Estado_de_Parqueo**: Indicador booleano que señala si una conversación está parqueada (en espera) o activa (no parqueada).
- **Parquear**: Acción de poner una conversación en estado de espera sin desconectarla.
- **Desparquear**: Acción de reactivar una conversación parqueada, lo cual dispara el envío de una plantilla al número de destino.
- **Línea_del_Agente**: Línea telefónica (canal) asignada al agente a través de sus grupos en Genesys Cloud. El widget solo muestra interacciones de las líneas del agente.
- **Selector_de_Línea**: Componente que permite al agente seleccionar cuál de sus líneas asignadas desea visualizar.
- **Grupos_del_Agente**: Grupos de Genesys Cloud a los que pertenece el agente, obtenidos expandiendo la información del usuario con `?expand=groups`. Cada grupo tiene números de teléfono asociados.
- **Servicio_de_Interacciones**: Módulo que provee la lista de interacciones abiertas filtradas por la línea seleccionada. Inicialmente implementado como un servicio mock reemplazable por la API real.
- **API_Proxy_de_Plantillas**: Ruta API de Next.js que actúa como proxy para enviar plantillas a través de Infobip usando autenticación Basic Auth.
- **Módulo_de_Autenticación**: Módulo que gestiona la autenticación OAuth con Genesys Cloud usando el flujo de concesión implícita (implicit grant).
- **Token_de_Acceso**: Token OAuth obtenido de Genesys Cloud que autoriza las llamadas a la API de la plataforma.
- **Skeleton_Loader**: Componente visual de carga que muestra una animación shimmer mientras se obtienen datos asincrónicos.

## Requisitos

### Requisito 1: Autenticación OAuth con Genesys Cloud

**Historia de Usuario:** Como agente, quiero que el widget se autentique automáticamente con Genesys Cloud, para poder acceder a las funcionalidades sin pasos manuales adicionales.

#### Criterios de Aceptación

1. WHEN el Widget se carga por primera vez, THE Módulo_de_Autenticación SHALL buscar un Token_de_Acceso existente en el hash de la URL, los parámetros de consulta o en localStorage.
2. WHEN un Token_de_Acceso válido se encuentra en cualquiera de las fuentes, THE Módulo_de_Autenticación SHALL almacenar el Token_de_Acceso en localStorage y permitir el acceso al Widget.
3. WHEN no se encuentra un Token_de_Acceso en ninguna fuente, THE Módulo_de_Autenticación SHALL redirigir al agente a la página de inicio de sesión de Genesys Cloud usando el flujo de concesión implícita OAuth.
4. WHEN un Token_de_Acceso se obtiene, THE Módulo_de_Autenticación SHALL validar el token llamando al endpoint `/api/v2/users/me` de Genesys Cloud.
5. IF la validación del Token_de_Acceso falla, THEN THE Módulo_de_Autenticación SHALL eliminar el token inválido de localStorage y redirigir al agente a la página de inicio de sesión de Genesys Cloud.
6. THE Módulo_de_Autenticación SHALL utilizar las variables de entorno NEXT_PUBLIC_GENESYS_CLIENT_ID y NEXT_PUBLIC_GENESYS_ENVIRONMENT para configurar el flujo OAuth.

### Requisito 2: Obtención de Líneas del Agente

**Historia de Usuario:** Como agente, quiero que el widget cargue automáticamente las líneas telefónicas asignadas a mis grupos, para ver únicamente las interacciones que me corresponden.

#### Criterios de Aceptación

1. WHEN el agente se autentica exitosamente, THE Módulo_de_Autenticación SHALL obtener los grupos del agente llamando al endpoint `/api/v2/users/{userId}?expand=groups` de Genesys Cloud.
2. WHEN los Grupos_del_Agente se obtienen, THE Widget SHALL consultar los números de teléfono asociados a cada grupo a través del endpoint proxy `/api/proxy-group-phones?group_id={groupId}`.
3. THE Widget SHALL consolidar los números de teléfono de todos los grupos del agente, eliminando duplicados.
4. WHEN las líneas se cargan exitosamente, THE Widget SHALL auto-seleccionar la primera línea disponible si el agente no ha seleccionado ninguna previamente.
5. THE Widget SHALL mostrar un Selector_de_Línea que permita al agente cambiar entre sus líneas asignadas.
6. WHEN el agente selecciona una línea diferente, THE Widget SHALL filtrar las interacciones para mostrar solo las correspondientes a la línea seleccionada.
7. WHILE las líneas se están cargando, THE Widget SHALL mostrar un indicador de carga con el texto "Cargando líneas...".
8. IF el agente no tiene grupos asignados, THEN THE Widget SHALL intentar cargar las líneas desde el endpoint proxy `/api/proxy-channels` como fallback.

### Requisito 3: Obtención de Interacciones Abiertas

**Historia de Usuario:** Como agente, quiero ver una lista de todas las interacciones abiertas, para poder gestionar mis conversaciones activas de forma eficiente.

#### Criterios de Aceptación

1. WHEN el Widget se carga y el agente está autenticado, THE Servicio_de_Interacciones SHALL obtener la lista de interacciones abiertas y entregarla al Widget.
2. THE Servicio_de_Interacciones SHALL proveer para cada interacción: identificador único, línea de origen, línea de destino, marca de tiempo de inicio y Estado_de_Parqueo.
3. THE Servicio_de_Interacciones SHALL implementarse inicialmente como un servicio mock con datos simulados que respete la misma interfaz TypeScript que la API real.
4. WHEN la API real de interacciones esté disponible, THE Servicio_de_Interacciones SHALL poder reemplazarse sin modificar los componentes que lo consumen, gracias a una interfaz compartida.
5. IF el Servicio_de_Interacciones falla al obtener las interacciones, THEN THE Widget SHALL mostrar un mensaje de error descriptivo con una acción de reintento.

### Requisito 4: Visualización de la Lista de Interacciones

**Historia de Usuario:** Como agente, quiero ver las interacciones en tarjetas horizontales claras, para poder identificar rápidamente la información relevante de cada conversación.

#### Criterios de Aceptación

1. THE Widget SHALL mostrar cada interacción como una Tarjeta_de_Interacción horizontal que contenga: línea de origen, línea de destino, duración de la interacción y Estado_de_Parqueo.
2. THE Widget SHALL calcular y mostrar la duración de cada interacción en tiempo real a partir de la marca de tiempo de inicio.
3. THE Widget SHALL diferenciar visualmente las tarjetas de interacciones parqueadas de las no parqueadas usando colores semánticos distintos.
4. WHILE las interacciones se están cargando, THE Widget SHALL mostrar un Skeleton_Loader con animación shimmer en lugar de las tarjetas.
5. WHEN no existen interacciones abiertas, THE Widget SHALL mostrar un mensaje indicando que no hay interacciones disponibles.
6. THE Widget SHALL ser responsivo y adaptarse al contexto de un widget embebido en Genesys Cloud.

### Requisito 5: Parqueo de Conversaciones

**Historia de Usuario:** Como agente, quiero poder parquear una conversación activa, para ponerla en espera mientras atiendo otras tareas.

#### Criterios de Aceptación

1. WHEN el agente presiona el botón de parquear en una Tarjeta_de_Interacción no parqueada, THE Widget SHALL cambiar el Estado_de_Parqueo de la interacción a parqueada.
2. WHEN una interacción se parquea, THE Tarjeta_de_Interacción SHALL actualizar su apariencia visual para reflejar el nuevo estado de parqueo.
3. THE Widget SHALL aplicar una transición visual de entre 150ms y 300ms al cambiar el estado de parqueo de una tarjeta.

### Requisito 6: Desparqueo de Conversaciones y Envío de Plantilla

**Historia de Usuario:** Como agente, quiero desparquear una conversación, para reactivarla y notificar automáticamente al cliente mediante una plantilla.

#### Criterios de Aceptación

1. WHEN el agente presiona el botón de desparquear en una Tarjeta_de_Interacción parqueada, THE Widget SHALL cambiar el Estado_de_Parqueo de la interacción a no parqueada.
2. WHEN una interacción se desparquea, THE Widget SHALL invocar a la API_Proxy_de_Plantillas para enviar una plantilla al número de la línea de destino de la interacción.
3. WHILE la API_Proxy_de_Plantillas está procesando el envío, THE Widget SHALL mostrar un indicador de carga en la Tarjeta_de_Interacción correspondiente.
4. IF la API_Proxy_de_Plantillas falla al enviar la plantilla, THEN THE Widget SHALL mostrar un mensaje de error en la Tarjeta_de_Interacción y permitir reintentar el envío.
5. WHEN una interacción se desparquea exitosamente, THE Tarjeta_de_Interacción SHALL actualizar su apariencia visual para reflejar el estado no parqueado.

### Requisito 7: API Proxy para Envío de Plantillas

**Historia de Usuario:** Como sistema, quiero una ruta API proxy en Next.js que envíe plantillas a través de Infobip, para que las credenciales de autenticación no se expongan en el cliente.

#### Criterios de Aceptación

1. THE API_Proxy_de_Plantillas SHALL exponer un endpoint POST en la ruta `/api/send-template` de Next.js.
2. WHEN la API_Proxy_de_Plantillas recibe una solicitud válida, THE API_Proxy_de_Plantillas SHALL reenviar la solicitud al endpoint `https://uqll2l7vg0.execute-api.us-east-1.amazonaws.com/dev/send-template` con autenticación Basic Auth.
3. THE API_Proxy_de_Plantillas SHALL construir las credenciales Basic Auth a partir de las variables de entorno BASIC_AUTH_USER y BASIC_AUTH_PASS.
4. IF la solicitud al endpoint externo falla, THEN THE API_Proxy_de_Plantillas SHALL retornar un código de estado HTTP apropiado y un mensaje de error descriptivo al cliente.
5. IF la solicitud recibida no contiene los campos requeridos, THEN THE API_Proxy_de_Plantillas SHALL retornar un código de estado HTTP 400 con un mensaje indicando los campos faltantes.
6. WHEN la API_Proxy_de_Plantillas recibe una solicitud con un método HTTP diferente a POST, THE API_Proxy_de_Plantillas SHALL retornar un código de estado HTTP 405.

### Requisito 8: Marca Xlink en el Widget

**Historia de Usuario:** Como agente, quiero ver la marca Xlink en el widget, para identificar claramente que esta herramienta pertenece al ecosistema del producto principal.

#### Criterios de Aceptación

1. THE Widget SHALL mostrar el logotipo de Xlink (`xlink_logo_v2.png`) en la cabecera del widget.
2. THE logotipo SHALL tener un atributo alt descriptivo ("Xlink logo") para accesibilidad.
3. THE cabecera del Widget SHALL incluir el nombre del widget ("Conversation Parking") junto al logotipo de Xlink.
4. THE logotipo SHALL adaptarse correctamente a modo oscuro y modo claro sin perder legibilidad.

### Requisito 9: Accesibilidad del Widget

**Historia de Usuario:** Como agente con necesidades de accesibilidad, quiero que el widget sea navegable por teclado y compatible con lectores de pantalla, para poder utilizarlo sin depender exclusivamente del ratón.

#### Criterios de Aceptación

1. THE Widget SHALL cumplir con las ratios de contraste de color según las pautas de accesibilidad WCAG para todos los textos e íconos.
2. THE Widget SHALL permitir la navegación completa por teclado entre las tarjetas de interacción y los botones de acción.
3. THE Widget SHALL incluir atributos aria-label descriptivos en todos los elementos interactivos (botones de parquear/desparquear).
4. THE Widget SHALL asegurar que todos los elementos interactivos tengan un área de toque mínima de 44x44 píxeles.
5. THE Widget SHALL soportar modo oscuro y modo claro, adaptándose a la preferencia del sistema operativo del agente mediante variables CSS.

### Requisito 10: Estados de Carga y Error

**Historia de Usuario:** Como agente, quiero ver indicadores claros cuando el widget está cargando o cuando ocurre un error, para entender el estado actual del sistema.

#### Criterios de Aceptación

1. WHILE el Módulo_de_Autenticación está validando el Token_de_Acceso, THE Widget SHALL mostrar un indicador de carga general.
2. WHILE el Servicio_de_Interacciones está obteniendo datos, THE Widget SHALL mostrar componentes Skeleton_Loader con animación shimmer.
3. IF ocurre un error de red al comunicarse con cualquier servicio, THEN THE Widget SHALL mostrar un mensaje de error con una descripción del problema y un botón de reintento.
4. WHEN el agente presiona el botón de reintento después de un error, THE Widget SHALL volver a intentar la operación fallida.
