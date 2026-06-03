import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth } from "./useAuth";
import type { GenesysCredentials } from "../../domain/entities/tenant";

// Mock the genesys-auth adapter
// Updated signatures (multi-tenant):
//   redirectToLogin(clientId: string, environment: string): void
//   validateToken(token: string, environment?: string): Promise<{ name, id, groupIds }>
vi.mock("../../infrastructure/adapters/genesys-auth.adapter", () => ({
  extractToken: vi.fn(),
  validateToken: vi.fn(),
  clearToken: vi.fn(),
  redirectToLogin: vi.fn(),
}));

import {
  extractToken,
  validateToken,
  clearToken,
  redirectToLogin,
} from "../../infrastructure/adapters/genesys-auth.adapter";

const mockExtractToken = vi.mocked(extractToken);
const mockValidateToken = vi.mocked(validateToken);
const mockClearToken = vi.mocked(clearToken);
const mockRedirectToLogin = vi.mocked(redirectToLogin);

const TEST_CREDENTIALS: GenesysCredentials = {
  genesys_client_id: "test-client-id",
  genesys_client_secret: "test-secret",
  environment: "mypurecloud.com",
};

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays in loading state when credentials are null", () => {
    mockExtractToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(null));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    // Should not attempt any auth operations without credentials
    expect(mockExtractToken).not.toHaveBeenCalled();
    expect(mockRedirectToLogin).not.toHaveBeenCalled();
  });

  it("starts in loading state with valid credentials", () => {
    mockExtractToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("redirects to login with clientId and environment when no token is found (first attempt)", async () => {
    mockExtractToken.mockReturnValue(null);

    renderHook(() => useAuth(TEST_CREDENTIALS));

    await waitFor(() => {
      expect(mockRedirectToLogin).toHaveBeenCalledTimes(1);
    });

    // Verify the adapter is called with the multi-tenant params
    expect(mockRedirectToLogin).toHaveBeenCalledWith(
      TEST_CREDENTIALS.genesys_client_id,
      TEST_CREDENTIALS.environment
    );
  });

  it("authenticates successfully when token is valid", async () => {
    mockExtractToken.mockReturnValue("valid-token");
    mockValidateToken.mockResolvedValue({
      name: "Agent Smith",
      id: "agent-123",
      groupIds: ["group-a", "group-b"],
    });

    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.token).toBe("valid-token");
    expect(result.current.agent).toEqual({ name: "Agent Smith", id: "agent-123" });
    expect(result.current.agentGroupIds).toEqual(["group-a", "group-b"]);
    expect(result.current.error).toBeNull();
    // Verify validateToken is called with token and environment
    expect(mockValidateToken).toHaveBeenCalledWith(
      "valid-token",
      TEST_CREDENTIALS.environment
    );
  });

  it("clears token and shows error when validation fails (no redirect loop)", async () => {
    mockExtractToken.mockReturnValue("bad-token");
    mockValidateToken.mockRejectedValue(new Error("Token validation failed with status 401"));

    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBe("Token validation failed with status 401");
    expect(mockClearToken).toHaveBeenCalled();
    // Should NOT redirect on validation failure to prevent redirect loops
    expect(mockRedirectToLogin).not.toHaveBeenCalled();
  });

  it("sets error message for non-Error thrown values", async () => {
    mockExtractToken.mockReturnValue("some-token");
    mockValidateToken.mockRejectedValue("unexpected");

    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Authentication failed");
  });
});
