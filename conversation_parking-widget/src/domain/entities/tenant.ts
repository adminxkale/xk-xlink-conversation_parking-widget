export interface TenantInfo {
  tenant_id: string;
}

export interface GenesysCredentials {
  genesys_client_id: string;
  genesys_client_secret: string;
  environment: string;
}

export interface TenantResolutionState {
  status: 'idle' | 'resolving-tenant' | 'fetching-credentials' | 'resolved' | 'error';
  org: string | null;
  tenantId: string | null;
  credentials: GenesysCredentials | null;
  error: string | null;
}
