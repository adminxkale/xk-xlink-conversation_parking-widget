# Requirements Document

## Introduction

Este documento especifica los requisitos para implementar soporte multi-tenant en el flujo de autenticación del widget. Actualmente, las credenciales de Genesys Cloud (client ID y environment) están hardcodeadas como variables de entorno. El nuevo flujo resuelve dinámicamente las credenciales de Genesys por organización (tenant), permitiendo que una sola instancia del widget sirva a múltiples organizaciones.

El flujo añade tres pasos previos a la autenticación OAuth existente: extraer el identificador de organización de la URL, resolver el tenant en Xlink, y obtener los secretos de Genesys para ese tenant.

## Glossary

- **Widget**: La aplicación SPA Conversation Parking Widget que se embebe en interfaces de contact center.
- **Org_Parameter**: Parámetro de query string `org` presente en la URL donde se carga el widget. Identifica la organización del contact center.
- **Tenant_Resolver**: Componente server-side (ruta API proxy) que traduce un identificador de organización a un `tenant_id` interno de Xlink.
- **Secret_Resolver**: Componente server-side (ruta API proxy) que obtiene las credenciales de Genesys Cloud para un tenant específico.
- **Tenant_ID**: Identificador interno de Xlink que representa a un tenant registrado en la plataforma.
- **Genesys_Credentials**: Conjunto de datos necesarios para autenticar contra Genesys Cloud: `genesys_client_id`, `genesys_client_secret` y `environment`.
- **Auth_Flow**: Secuencia completa de pasos desde la carga del widget hasta la obtención de un token OAuth válido de Genesys Cloud.
- **Basic_Auth**: Esquema de autenticación HTTP Basic usado para las llamadas server-side a la API de Xlink, construido a partir de AUTH_USER y AUTH_PASS.
- **Xlink_API**: API REST de la plataforma Xlink en `https://api.xlinkapp.cloud`.

## Requirements

### Requirement 1: Extract Organization Parameter from URL

**User Story:** As a contact center agent, I want the widget to automatically detect which organization I belong to from the URL, so that I get tenant-specific credentials without manual configuration.

#### Acceptance Criteria

1. WHEN the Widget loads, THE Widget SHALL extract the `org` query parameter from the current URL.
2. WHEN the `org` query parameter is present, THE Widget SHALL store the extracted value in localStorage under the key `xlink_org`.
3. WHEN the `org` query parameter is absent and no value exists in localStorage under `xlink_org`, THE Widget SHALL display an error message indicating that the organization parameter is missing.
4. WHEN the `org` query parameter is absent and a value exists in localStorage under `xlink_org`, THE Widget SHALL use the stored value as the organization identifier.
5. IF the `org` query parameter is absent and localStorage access fails or returns an unusable value, THEN THE Widget SHALL display an error message indicating that the organization could not be determined.
6. WHEN the `org` query parameter is present, THE Widget SHALL remove the `org` parameter from the URL without triggering a page reload.

### Requirement 2: Resolve Tenant from Organization Identifier

**User Story:** As a contact center agent, I want the widget to resolve my organization to an internal tenant, so that the correct Genesys credentials are used for authentication.

#### Acceptance Criteria

1. WHEN the Widget has a valid organization identifier, THE Tenant_Resolver SHALL make a GET request to `https://api.xlinkapp.cloud/management-multitenant/external/management-tables/tenant/{org}` where `{org}` is the organization identifier.
2. THE Tenant_Resolver SHALL authenticate the request using Basic_Auth constructed from server-side environment variables AUTH_USER and AUTH_PASS.
3. WHEN the Xlink_API returns a successful response containing a `tenant_id` field, THE Tenant_Resolver SHALL extract the `tenant_id` and return it to the client.
4. IF the Xlink_API returns a successful response but the `tenant_id` field is absent or empty, THEN THE Tenant_Resolver SHALL return an error response with status 502 indicating that tenant resolution failed.
5. IF the Xlink_API returns an HTTP error status, THEN THE Tenant_Resolver SHALL return an error response with status 502 and a descriptive error message.
6. IF the `org` query parameter is missing from the request to the Tenant_Resolver, THEN THE Tenant_Resolver SHALL return an error response with status 400 indicating the missing parameter.

### Requirement 3: Fetch Genesys Credentials for Tenant

**User Story:** As a contact center agent, I want the widget to retrieve Genesys Cloud credentials specific to my organization, so that I authenticate against the correct Genesys environment.

#### Acceptance Criteria

1. WHEN the Widget has a valid Tenant_ID, THE Secret_Resolver SHALL make a GET request to `https://api.xlinkapp.cloud/management-secret/secret?secretId=/xlink/{STAGE}/integration/widget/{tenantId}` where `{STAGE}` is the deployment stage from server-side environment variable STAGE and `{tenantId}` is the resolved tenant identifier.
2. THE Secret_Resolver SHALL authenticate the request using Basic_Auth constructed from server-side environment variables AUTH_USER and AUTH_PASS.
3. WHEN the Xlink_API returns a successful response, THE Secret_Resolver SHALL return the response body containing `genesys_client_id`, `genesys_client_secret`, and `environment` fields.
4. IF the Xlink_API returns a successful response but the required credential fields are absent, THEN THE Secret_Resolver SHALL return an error response with status 502 indicating that credential retrieval failed.
5. IF the Xlink_API returns an HTTP error status, THEN THE Secret_Resolver SHALL return an error response with status 502 and a descriptive error message.
6. IF the Secret_Resolver encounters an internal failure while processing the response, THEN THE Secret_Resolver SHALL return an error response with status 500 and a descriptive error message.
7. IF the `tenantId` query parameter is missing from the request to the Secret_Resolver, THEN THE Secret_Resolver SHALL return an error response with status 400 indicating the missing parameter.

### Requirement 4: Dynamic OAuth Authentication with Tenant Credentials

**User Story:** As a contact center agent, I want the widget to use my organization's specific Genesys credentials for OAuth, so that I authenticate against the correct Genesys Cloud environment.

#### Acceptance Criteria

1. WHEN the Widget has obtained Genesys_Credentials from the Secret_Resolver, THE Auth_Flow SHALL use the `genesys_client_id` from the response as the OAuth client ID for the Implicit Grant flow.
2. WHEN the Widget has obtained Genesys_Credentials from the Secret_Resolver, THE Auth_Flow SHALL use the `environment` from the response to construct the Genesys login URL and API base URL.
3. WHEN the Widget redirects to the Genesys OAuth login page, THE Auth_Flow SHALL store the `environment` value in localStorage under the key `genesys_environment` for use during token validation after redirect.
4. WHEN the Widget returns from OAuth redirect with a token, THE Auth_Flow SHALL use the `environment` stored in localStorage to validate the token against the Genesys API.
5. THE Auth_Flow SHALL no longer depend on NEXT_PUBLIC_GENESYS_CLIENT_ID or NEXT_PUBLIC_GENESYS_ENVIRONMENT environment variables for OAuth configuration.

### Requirement 5: Multi-Tenant Authentication Startup Sequence

**User Story:** As a contact center agent, I want the widget to complete all tenant resolution steps before attempting OAuth login, so that authentication uses the correct credentials from the start.

#### Acceptance Criteria

1. THE Auth_Flow SHALL execute the following steps in order: extract org parameter, resolve tenant, fetch Genesys credentials, then proceed with OAuth authentication. THE Auth_Flow SHALL block OAuth authentication until tenant resolution successfully completes.
2. WHILE the tenant resolution steps are in progress, THE Widget SHALL display a loading indicator with descriptive text indicating the current step (resolving organization, fetching credentials).
3. IF any step in the tenant resolution sequence fails, THEN THE Widget SHALL display the error message and a retry button, without proceeding to OAuth authentication.
4. WHEN the user clicks the retry button after a tenant resolution failure, THE Widget SHALL restart the tenant resolution sequence from the beginning.
5. THE Widget SHALL cache the resolved Genesys_Credentials in localStorage under the key `genesys_credentials` to avoid re-resolving on page reloads when the `org` parameter has not changed.
6. WHEN the `org` parameter in the URL differs from the stored value in localStorage, THE Widget SHALL discard cached credentials and restart the tenant resolution sequence.

### Requirement 6: Server-Side Security for Proxy Routes

**User Story:** As a system administrator, I want the Xlink API credentials to remain server-side only, so that sensitive authentication data is not exposed to the browser.

#### Acceptance Criteria

1. THE Tenant_Resolver SHALL use environment variables AUTH_USER and AUTH_PASS (without NEXT_PUBLIC_ prefix) for Basic_Auth construction.
2. THE Secret_Resolver SHALL use environment variables AUTH_USER and AUTH_PASS (without NEXT_PUBLIC_ prefix) for Basic_Auth construction.
3. THE Tenant_Resolver SHALL NOT expose the Basic_Auth header value, raw credentials, or any server-side authentication data in the response body.
4. THE Secret_Resolver SHALL NOT expose the Basic_Auth header value, raw credentials, or any server-side authentication data in the response body.
5. THE Widget client-side code SHALL NOT import or reference AUTH_USER or AUTH_PASS environment variables.
6. THE Secret_Resolver SHALL only return the fields `genesys_client_id`, `genesys_client_secret`, and `environment` from the Xlink_API response, filtering out any additional server-side data.
