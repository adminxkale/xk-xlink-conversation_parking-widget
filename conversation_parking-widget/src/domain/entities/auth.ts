export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  agent: { name: string; id: string } | null;
  agentGroupIds: string[] | null;
  error: string | null;
}
