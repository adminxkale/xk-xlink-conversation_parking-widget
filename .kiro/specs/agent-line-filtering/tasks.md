# Plan de Implementación: Filtrado de Líneas por Agente

## Visión General

Reemplazar los datos mock de la ruta proxy `/api/proxy-group-phones` con llamadas reales a la API de Xlink Groups, actualizar el adaptador de líneas para parsear el formato real de respuesta (`phone_numbers` como objeto clave-valor), y mejorar el hook `useAgentLines` con degradación parcial por grupo usando `Promise.allSettled`.

## Tareas

- [x] 1. Actualizar la ruta proxy para llamar a la API real de Xlink Groups
  - [x] 1.1 Agregar la variable de entorno `XLINK_GROUPS_API_URL` en `.env.local`
    - Agregar `XLINK_GROUPS_API_URL=https://zqi6swpat4.execute-api.us-east-1.amazonaws.com/dev/xlink_groups` al archivo `.env.local`
    - _Requisitos: 1.5_

  - [x] 1.2 Reemplazar datos mock con llamada real a la API de Xlink Groups en `app/api/proxy-group-phones/route.ts`
    - Leer `XLINK_GROUPS_API_URL` de `process.env`
    - Construir URL: `{XLINK_GROUPS_API_URL}/{group_id}?partitionKey=group_id`
    - Hacer `fetch` GET a la URL construida
    - Si éxito: reenviar el body de la respuesta sin modificar
    - Si `XLINK_GROUPS_API_URL` no está configurada: retornar 500 con mensaje de configuración
    - Si la API Xlink retorna error: retornar 502 con mensaje descriptivo incluyendo código de estado original
    - Si error de red: retornar 502 con mensaje de conectividad
    - Mantener la validación existente de `group_id` (400 si falta)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.3 Escribir tests unitarios para la ruta proxy actualizada
    - Test: llamada correcta a API Xlink con `group_id` válido
    - Test: error 400 cuando falta `group_id`
    - Test: error 500 cuando `XLINK_GROUPS_API_URL` no está configurada
    - Test: error 502 cuando la API Xlink retorna error HTTP
    - Test: URL construida correctamente desde variable de entorno
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Actualizar el adaptador de líneas para parsear el formato real de Xlink
  - [x] 2.1 Crear la función pura `parseXlinkGroupResponse` en `src/infrastructure/adapters/lines.adapter.ts`
    - Definir interfaz `XlinkGroupResponse` con `group_id: string` y `phone_numbers: Record<string, string>`
    - Implementar función exportada `parseXlinkGroupResponse(data: unknown, groupId: string): Line[]`
    - Validar que `data` sea un arreglo; retornar `[]` si no lo es
    - Para cada objeto del arreglo, extraer `phone_numbers` y crear una `Line` por cada par clave-valor
    - Mapeo: clave → `number`, valor → `phone_number`, `id`, `phone_number_id`; `groups` = `[groupId]`
    - Omitir objetos con `phone_numbers` vacío o ausente
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Actualizar `fetchGroupPhones` para usar `parseXlinkGroupResponse`
    - Reemplazar el parsing inline actual por una llamada a `parseXlinkGroupResponse(data, groupId)`
    - Mantener el manejo de errores HTTP existente (throw en respuesta no-ok)
    - _Requisitos: 2.1, 2.2, 2.3_

  - [ ]* 2.3 Escribir test de propiedad para round-trip de parsing Xlink → Line
    - **Propiedad 1: Round-trip de parsing Xlink → Line → phone_numbers**
    - Generar respuestas Xlink aleatorias con `group_id` y `phone_numbers` variados usando fast-check
    - Verificar que al parsear y reconstruir `phone_numbers` desde las entidades `Line`, el resultado sea equivalente al original
    - Mínimo 100 iteraciones
    - Tag: `Feature: agent-line-filtering, Property 1: Round-trip de parsing Xlink → Line → phone_numbers`
    - **Valida: Requisitos 2.1, 2.2, 2.3, 3.1**

  - [ ]* 2.4 Escribir test de propiedad para invariante estructural de entidades Line
    - **Propiedad 2: Invariante estructural de entidades Line parseadas**
    - Generar respuestas Xlink válidas con al menos un par clave-valor en `phone_numbers`
    - Verificar que todas las entidades `Line` generadas tengan `id`, `number`, `phone_number_id`, `phone_number` como strings no vacíos y `groups` como arreglo no vacío
    - Mínimo 100 iteraciones
    - Tag: `Feature: agent-line-filtering, Property 2: Invariante estructural de entidades Line parseadas`
    - **Valida: Requisito 3.2**

  - [ ]* 2.5 Escribir tests unitarios para el adaptador de líneas actualizado
    - Test: parsing de respuesta con un grupo y múltiples phone_numbers
    - Test: parsing con múltiples objetos en el arreglo
    - Test: `phone_numbers` vacío se omite sin error
    - Test: respuesta no-arreglo retorna `[]`
    - Test: mapeo correcto de campos (clave → `number`, valor → `phone_number`)
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2_

- [x] 3. Checkpoint - Verificar proxy y adaptador
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 4. Mejorar el hook useAgentLines con degradación parcial
  - [x] 4.1 Actualizar `useAgentLines` en `src/application/hooks/useAgentLines.ts` para usar `Promise.allSettled`
    - Reemplazar `Promise.all` por `Promise.allSettled` en la carga de líneas por grupo
    - Filtrar resultados: usar líneas de grupos exitosos (`fulfilled`), omitir grupos fallidos (`rejected`)
    - Si todos los grupos fallan: establecer error con mensaje descriptivo
    - Si algunos fallan: continuar con los exitosos sin mostrar error
    - Mantener el fallback a `fetchChannels` cuando no hay grupos
    - Mantener la auto-selección de la primera línea
    - _Requisitos: 5.1, 5.2, 5.3, 6.1, 6.3_

  - [ ]* 4.2 Escribir tests unitarios para el hook con degradación parcial
    - Test: un grupo falla, otros exitosos → muestra líneas de grupos exitosos
    - Test: todos los grupos fallan → muestra error
    - Test: sin grupos → fallback a channels
    - Test: auto-selección de primera línea tras carga exitosa
    - _Requisitos: 5.1, 5.2, 5.3, 6.1, 6.3_

- [x] 5. Validar consolidación con datos reales
  - [ ]* 5.1 Escribir test de propiedad para consolidación de líneas
    - **Propiedad 3: Consolidación deduplica por phone_number y fusiona grupos completamente**
    - Generar arreglos de `Line[]` con `phone_number` potencialmente duplicados entre grupos usando fast-check
    - Verificar: (a) cada `phone_number` aparece exactamente una vez, (b) cantidad de líneas ≤ entrada total, (c) `groups` contiene todos los `group_id` originales sin duplicados
    - Mínimo 100 iteraciones
    - Tag: `Feature: agent-line-filtering, Property 3: Consolidación deduplica por phone_number y fusiona grupos completamente`
    - **Valida: Requisitos 4.1, 4.2, 4.3**

- [x] 6. Integración y cableado final
  - [x] 6.1 Verificar integración end-to-end del flujo completo
    - Confirmar que el flujo Auth → obtener grupos → fetch por grupo → parsing → consolidación → render funciona correctamente con los cambios realizados
    - Verificar que no hay código huérfano o sin integrar
    - _Requisitos: 1.1, 1.2, 2.1, 4.1, 5.1_

  - [ ]* 6.2 Escribir tests de integración para el flujo completo
    - Test: carga completa de líneas desde auth hasta render en LineSelector
    - Test: degradación parcial (un grupo falla, otros se muestran)
    - Test: reintento tras error total
    - _Requisitos: 5.3, 6.1, 6.3_

- [ ] 7. Checkpoint final - Verificar todos los tests
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan las 3 propiedades de corrección definidas en el diseño
- Los tests unitarios validan escenarios específicos y casos borde
- El proyecto ya tiene Vitest, fast-check, React Testing Library y MSW configurados
