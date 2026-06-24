import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth } from "./useAuth";
import type { GenesysCredentials } from "../../domain/entities/tenant";

// Mock the genesys-auth adapter with the new PKCE-based functions
vi.mock("../../infrastructure/adapters/genesys-auth.adapter", () => ({
  loginWithPKCE: vi.fn(),
  clearToken: vi.fn(),
}));

import {
  loginWithPKCE,
  clearToken,
} from "../../infrastructure/adapters/genesys-auth.adapter";

const mockLoginWithPKCE = vi.mocked(loginWithPKCE);
const mockClearToken = vi.mocked(clearToken);

const TEST_CREDENTIALS: GenesysCredentials = {
  genesys_client_id: "test-client-id",
  genesys_client_secret: "test-secret",
  environment: "mypurecloud.com",
};

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays in loading state when credentials are null", () => {
    const { result } = renderHook(() => useAuth(null));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    // Should not attempt any auth operations without credentials
    expect(mockLoginWithPKCE).not.toHaveBeenCalled();
  });

  it("starts in loading state with valid credentials", () => {
    // loginWithPKCE returns a pending promise (never resolves in this test)
    mockLoginWithPKCE.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("authenticates successfully when loginWithPKCE resolves", async () => {
    mockLoginWithPKCE.mockResolvedValue({
      name: "Agent Smith",
      id: "agent-123",
      groupIds: ["group-a", "group-b"],
      token: "pkce-access-token",
    });

    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.token).toBe("pkce-access-token");
    expect(result.current.agent).toEqual({ name: "Agent Smith", id: "agent-123" });
    expect(result.current.agentGroupIds).toEqual(["group-a", "group-b"]);
    expect(result.current.error).toBeNull();
    // Verify loginWithPKCE is called with clientId and environment
    expect(mockLoginWithPKCE).toHaveBeenCalledWith(
      TEST_CREDENTIALS.genesys_client_id,
      TEST_CREDENTIALS.environment
    );
  });

  it("clears token and shows error when loginWithPKCE fails", async () => {
    mockLoginWithPKCE.mockRejectedValue(new Error("Token validation failed with status 401"));

    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBe("Token validation failed with status 401");
    expect(mockClearToken).toHaveBeenCalled();
  });

  it("sets generic error message for non-Error thrown values", async () => {
    mockLoginWithPKCE.mockRejectedValue("unexpected");

    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Authentication failed");
  });

  it("stays in loading state when SDK initiates a redirect", async () => {
    // When the SDK redirects to Genesys login, it rejects with a redirect-related message
    mockLoginWithPKCE.mockRejectedValue(new Error("Login redirect"));

    const { result } = renderHook(() => useAuth(TEST_CREDENTIALS));

    // Give time for the effect to run
    await waitFor(() => {
      expect(mockLoginWithPKCE).toHaveBeenCalled();
    });

    // Should stay in loading state (page is navigating away)
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockClearToken).not.toHaveBeenCalled();
  });
});
