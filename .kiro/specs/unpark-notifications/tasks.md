# Plan de Implementación: Notificaciones de Resultado al Desparquear

## Visión General

Implementar un sistema de notificaciones toast ligero para el widget de Conversation Parking, siguiendo la arquitectura hexagonal existente. El orden de implementación respeta las dependencias: entidad de dominio → hook de aplicación → componentes de presentación → context/provider → integración con useInteractions → integración con el widget principal.

## Tareas

- [x] 1. Crear la entidad de dominio Toast
  - [x] 1.1 Crear `src/domain/entities/toast.ts` con la interfaz `Toast` y el tipo `ToastType`
    - Definir `ToastType = 'success' | 'error'`
    - Definir interfaz `Toast` con campos: `id`, `type`, `message`, `createdAt`
    - _Requirements: 1.1, 2.1_

- [x] 2. Implementar el hook de aplicación useToast
  - [x] 2.1 Crear `src/application/hooks/useToast.ts`
    - Implementar estado interno con array de toasts activos
    - Implementar `addToast` que genera ID único y agrega toast al estado
    - Implementar `removeToast` que elimina un toast por ID
    - Programar auto-eliminación a 5000ms tras creación con `setTimeout`
    - Limpiar timers pendientes al desmontar el componente (`useEffect` cleanup)
    - _Requirements: 1.1, 2.1, 2.3, 3.1, 3.2_
  - [ ]* 2.2 Escribir test de propiedad para creación de toasts
    - **Propiedad 1: Correctitud en la creación de toasts según resultado de unpark**
    - **Validates: Requirements 1.1, 2.1, 2.3**
  - [ ]* 2.3 Escribir test de propiedad para ciclo de vida del toast
    - **Propiedad 2: Completitud del ciclo de vida del toast**
    - **Validates: Requirements 3.1, 3.3**
  - [ ]* 2.4 Escribir tests unitarios para useToast
    - Test: crear toast de éxito genera toast con tipo 'success' y mensaje correcto
    - Test: crear toast de error genera toast con tipo 'error' y mensaje correcto
    - Test: removeToast elimina el toast del array
    - Test: auto-dismiss remueve el toast después de 5000ms (fake timers)
    - Test: cleanup al desmontar cancela timers pendientes
    - _Requirements: 1.1, 2.1, 3.1, 3.2_

- [x] 3. Implementar componentes de presentación
  - [x] 3.1 Crear `src/presentation/components/ToastItem.tsx`
    - Renderizar toast individual con estilos condicionales según tipo
    - Estilo éxito: `bg-green-50 border-green-500` con icono de check
    - Estilo error: `bg-red-50 border-red-500` con icono de X
    - Incluir botón de cierre (×) que invoca `onDismiss`
    - Agregar atributos de accesibilidad: `role="alert"`, `aria-live="assertive"`
    - _Requirements: 1.2, 2.2, 3.3_
  - [x] 3.2 Crear `src/presentation/components/ToastContainer.tsx`
    - Posicionar con `fixed` en esquina superior derecha del widget
    - Usar `pointer-events-none` en el contenedor y `pointer-events-auto` en cada toast
    - Apilar toasts verticalmente con `flex flex-col gap-2`
    - Usar z-index 50 para estar sobre el contenido del widget
    - _Requirements: 1.3, 4.2, 4.3_
  - [ ]* 3.3 Escribir test de propiedad para apilamiento sin solapamiento
    - **Propiedad 3: Apilamiento sin solapamiento**
    - **Validates: Requirements 4.3**
  - [ ]* 3.4 Escribir tests unitarios para ToastItem y ToastContainer
    - Test: ToastItem renderiza estilo verde para tipo 'success'
    - Test: ToastItem renderiza estilo rojo para tipo 'error'
    - Test: ToastItem dispara onDismiss al hacer click en botón de cierre
    - Test: ToastContainer renderiza múltiples toasts
    - Test: ToastContainer tiene pointer-events-none en el overlay
    - _Requirements: 1.2, 2.2, 3.3, 4.2_

- [x] 4. Checkpoint - Verificar tests de capas inferiores
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Crear el Context Provider de Toast
  - [x] 5.1 Crear `src/presentation/providers/ToastContext.tsx`
    - Definir `ToastContextValue` con `addToast` y `removeToast`
    - Crear el contexto con `createContext`
    - Exportar hook `useToastContext` para consumir el contexto
    - _Requirements: 1.1, 2.1_
  - [x] 5.2 Crear `src/presentation/components/ToastProvider.tsx`
    - Ejecutar `useToast()` internamente
    - Proveer `addToast` y `removeToast` vía `ToastContext.Provider`
    - Renderizar `ToastContainer` con los toasts actuales como children del provider
    - _Requirements: 1.1, 2.1, 3.1, 4.3_

- [x] 6. Integrar con useInteractions
  - [x] 6.1 Modificar `src/application/hooks/useInteractions.ts`
    - Agregar parámetro opcional `addToast` a la firma del hook
    - En caso de éxito de unpark: llamar `addToast({ type: 'success', message: 'Conversación desparqueada exitosamente' })`
    - En caso de error de unpark: llamar `addToast({ type: 'error', message })` con el mensaje del error o el mensaje por defecto
    - Remover la llamada a `setError()` en el catch de unpark (desacoplar del error general)
    - _Requirements: 1.1, 2.1, 2.3, 5.1, 5.2_
  - [ ]* 6.2 Escribir test de propiedad para desacoplamiento del estado de error
    - **Propiedad 4: Desacoplamiento del estado de error general**
    - **Validates: Requirements 5.1**
  - [ ]* 6.3 Actualizar tests unitarios de useInteractions
    - Test: unpark exitoso llama addToast con tipo 'success'
    - Test: unpark fallido llama addToast con tipo 'error' y no modifica estado `error`
    - Test: unpark fallido sin mensaje usa mensaje por defecto
    - _Requirements: 1.1, 2.1, 2.3, 5.1_

- [x] 7. Integrar con ConversationParkingWidget
  - [x] 7.1 Modificar `src/presentation/components/ConversationParkingWidget.tsx`
    - Envolver el contenido del widget con `ToastProvider`
    - Consumir `useToastContext()` para obtener `addToast`
    - Pasar `addToast` como parámetro a `useInteractions`
    - _Requirements: 4.1, 4.2_

- [x] 8. Checkpoint final - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan correctitud universal con fast-check (mínimo 100 iteraciones)
- Los tests unitarios validan ejemplos específicos y edge cases
- Tag format para property tests: `Feature: unpark-notifications, Property N: [título]`
