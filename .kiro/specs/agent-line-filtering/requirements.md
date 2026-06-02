# Documento de Requisitos — Filtrado de Líneas por Agente

## Introducción

Mejora del Conversation Parking Widget para integrar datos reales de grupos de agentes desde Genesys Cloud y la API externa Xlink Groups. Actualmente, la ruta proxy `/api/proxy-group-phones` retorna datos mock y el adaptador de líneas (`lines.adapter.ts`) no parsea correctamente el formato de respuesta real de la API externa. Esta mejora reemplaza los datos simulados con llamadas reales a la API de Xlink Groups (`https://zqi6swpat4.execute-api.us-east-1.amazonaws.com/dev/xlink_groups/{group_id}?partitionKey=group_id`), actualiza el parsing del adaptador para manejar el formato real donde `phone_numbers` es un objeto con pares `{nombre: número_de_teléfono}`, y asegura que la consolidación y el flujo completo funcionen correctamente con datos reales.

## Glosario

- **Widget**: Aplicación web del Conversation Parking Widget embebida en Genesys Cloud.
- **API_Proxy_Group_Phones**: Ruta API de Next.js en `/api/proxy-group-phones` que actúa como proxy entre el cliente y la API externa de Xlink Groups.
- **API_Xlink_Groups**: API externa en `https://zqi6swpat4.execute-api.us-east-1.amazonaws.com/dev/xlink_groups/{group_id}?partitionKey=group_id` que retorna los números de teléfono asociados a un grupo.
- **Respuesta_Xlink**: Formato de respuesta de la API_Xlink_Groups: un arreglo de objetos donde cada objeto contiene una propiedad `group_id` (string) y una propiedad `phone_numbers` que es un objeto con pares clave-valor `{ "nombre_descriptivo": "número_de_teléfono", ... }`.
- **Adaptador_de_Líneas**: Módulo `lines.adapter.ts` en la capa de infraestructura que transforma las respuestas de la API_Proxy_Group_Phones en entidades `Line` del dominio.
- **Línea**: Entidad del dominio (`Line`) que representa un número de teléfono asignado a un agente, con campos `id`, `number`, `phone_number_id`, `phone_number` y `groups`.
- **Consolidador_de_Líneas**: Caso de uso `consolidate-lines.ts` que elimina duplicados de líneas provenientes de múltiples grupos, fusionando los arreglos de grupos asociados.
- **Grupos_del_Agente**: Grupos de Genesys Cloud a los que pertenece el agente autenticado, obtenidos durante la autenticación OAuth.

## Requisitos

### Requisito 1: Integración de la API Proxy con la API Real de Xlink Groups

**Historia de Usuario:** Como desarrollador, quiero que la ruta proxy `/api/proxy-group-phones` llame a la API real de Xlink Groups en lugar de retornar datos mock, para que el widget muestre los números de teléfono reales asociados a cada grupo del agente.

#### Criterios de Aceptación

1. WHEN la API_Proxy_Group_Phones recibe una solicitud GET con el parámetro `group_id`, THE API_Proxy_Group_Phones SHALL realizar una solicitud GET a `https://zqi6swpat4.execute-api.us-east-1.amazonaws.com/dev/xlink_groups/{group_id}?partitionKey=group_id` usando el `group_id` proporcionado.
2. WHEN la API_Xlink_Groups retorna una respuesta exitosa, THE API_Proxy_Group_Phones SHALL reenviar el cuerpo de la respuesta al cliente sin modificaciones.
3. IF la solicitud GET no incluye el parámetro `group_id`, THEN THE API_Proxy_Group_Phones SHALL retornar un código de estado HTTP 400 con un mensaje indicando que el parámetro `group_id` es requerido.
4. IF la API_Xlink_Groups retorna un error o no responde, THEN THE API_Proxy_Group_Phones SHALL retornar un código de estado HTTP 502 con un mensaje de error descriptivo que incluya el código de estado original.
5. THE API_Proxy_Group_Phones SHALL construir la URL de la API_Xlink_Groups a partir de una variable de entorno configurable para la URL base, evitando codificar la URL directamente en el código fuente.

### Requisito 2: Parsing Correcto del Formato de Respuesta de Xlink Groups

**Historia de Usuario:** Como desarrollador, quiero que el adaptador de líneas parsee correctamente el formato real de la API de Xlink Groups, para que los números de teléfono se transformen correctamente en entidades `Line` del dominio.

#### Criterios de Aceptación

1. WHEN el Adaptador_de_Líneas recibe una Respuesta_Xlink, THE Adaptador_de_Líneas SHALL extraer los números de teléfono de la propiedad `phone_numbers` de cada objeto del arreglo, tratando `phone_numbers` como un objeto con pares clave-valor `{ "nombre": "número_de_teléfono" }`.
2. WHEN el Adaptador_de_Líneas procesa un par clave-valor de `phone_numbers`, THE Adaptador_de_Líneas SHALL crear una entidad Línea donde el campo `number` corresponda a la clave (nombre descriptivo), el campo `phone_number` corresponda al valor (número de teléfono), el campo `id` sea el número de teléfono, el campo `phone_number_id` sea el número de teléfono, y el campo `groups` contenga el `group_id` del objeto padre.
3. WHEN la Respuesta_Xlink contiene múltiples objetos en el arreglo, THE Adaptador_de_Líneas SHALL procesar todos los objetos y retornar todas las líneas extraídas en un único arreglo.
4. IF la Respuesta_Xlink contiene un objeto donde `phone_numbers` está vacío o ausente, THEN THE Adaptador_de_Líneas SHALL omitir ese objeto y continuar procesando los demás sin generar un error.
5. IF la Respuesta_Xlink no es un arreglo válido, THEN THE Adaptador_de_Líneas SHALL retornar un arreglo vacío.

### Requisito 3: Parsing de Respuesta con Round-Trip Verificable

**Historia de Usuario:** Como desarrollador, quiero que la transformación de datos de la API a entidades del dominio sea verificable mediante round-trip, para garantizar que no se pierda información durante el parsing.

#### Criterios de Aceptación

1. FOR ALL Respuesta_Xlink válidas, al parsear la respuesta a entidades Línea y luego reconstruir el formato `phone_numbers` original a partir de las entidades, THE Adaptador_de_Líneas SHALL producir un objeto `phone_numbers` equivalente al original para cada grupo.
2. FOR ALL entidades Línea generadas por el Adaptador_de_Líneas, cada entidad SHALL contener campos `id`, `number`, `phone_number_id`, `phone_number` y `groups` con valores de tipo string no vacío (excepto `groups` que es un arreglo de strings no vacío).

### Requisito 4: Consolidación de Líneas con Datos Reales

**Historia de Usuario:** Como agente, quiero que las líneas de todos mis grupos se consoliden correctamente eliminando duplicados, para ver cada número de teléfono una sola vez en el selector de líneas.

#### Criterios de Aceptación

1. WHEN el Widget recibe líneas de múltiples grupos que contienen el mismo `phone_number`, THE Consolidador_de_Líneas SHALL retener una única entrada por `phone_number` y fusionar los arreglos `groups` de todas las ocurrencias.
2. FOR ALL conjuntos de líneas de entrada, la cantidad de líneas consolidadas SHALL ser menor o igual a la cantidad total de líneas de entrada.
3. FOR ALL líneas consolidadas, el arreglo `groups` SHALL contener todos los `group_id` de los grupos originales que contenían ese `phone_number`, sin duplicados.

### Requisito 5: Auto-selección y Fallback con Datos Reales

**Historia de Usuario:** Como agente, quiero que el widget auto-seleccione la primera línea disponible y use un fallback si no tengo grupos, para poder empezar a trabajar sin configuración manual.

#### Criterios de Aceptación

1. WHEN las líneas se cargan exitosamente desde la API real y el agente no ha seleccionado una línea previamente, THE Widget SHALL auto-seleccionar la primera línea del arreglo consolidado.
2. IF el agente no tiene Grupos_del_Agente asignados, THEN THE Widget SHALL cargar las líneas desde el endpoint `/api/proxy-channels` como mecanismo de fallback.
3. IF la API_Proxy_Group_Phones falla para un grupo específico, THEN THE Widget SHALL omitir ese grupo y continuar cargando las líneas de los grupos restantes.
4. WHILE las líneas se están cargando desde la API real, THE Widget SHALL mostrar un indicador de carga con el texto "Cargando líneas...".

### Requisito 6: Manejo de Errores en la Integración con API Real

**Historia de Usuario:** Como agente, quiero que el widget maneje correctamente los errores de la API real, para no quedarme sin funcionalidad cuando hay problemas de conectividad.

#### Criterios de Aceptación

1. IF la API_Proxy_Group_Phones falla para todos los grupos del agente, THEN THE Widget SHALL mostrar un mensaje de error descriptivo con un botón de reintento.
2. IF la API_Xlink_Groups retorna una respuesta con formato inesperado, THEN THE Adaptador_de_Líneas SHALL tratar la respuesta como un arreglo vacío sin generar una excepción no controlada.
3. IF ocurre un error de red al comunicarse con la API_Proxy_Group_Phones, THEN THE Widget SHALL mostrar un mensaje de error con una descripción del problema y un botón de reintento.
