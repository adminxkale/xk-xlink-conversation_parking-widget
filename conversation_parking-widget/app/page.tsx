"use client";

import { TenantResolutionGuard } from '../src/presentation/components/TenantResolutionGuard';
import { AuthProvider } from '../src/presentation/components/AuthProvider';
import { ConversationParkingWidget } from '../src/presentation/components/ConversationParkingWidget';

export default function Home() {
  return (
    <TenantResolutionGuard>
      {(credentials, tenantId) => (
        <AuthProvider credentials={credentials} tenantId={tenantId}>
          <ConversationParkingWidget />
        </AuthProvider>
      )}
    </TenantResolutionGuard>
  );
}
