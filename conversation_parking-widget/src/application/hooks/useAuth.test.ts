import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth } from "./useAuth";

// Mock the genesys-auth adapter
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

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in loading state", () => {
    mockExtractToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("redirects to login when no token is found (first attempt)", async () => {
    mockExtractToken.mockReturnValue(null);
    // Ensure no redirect flag is set
    sessionStorage.removeItem('auth_redirect_pending');
    renderHook(() => useAuth());

    await waitFor(() => {
      expect(mockRedirectToLogin).toHaveBeenCalled();
    });
  });

  it("authenticates successfully when token is valid", async () => {
    mockExtractToken.mockReturnValue("valid-token");
    mockValidateToken.mockResolvedValue({
      name: "Agent Smith",
      id: "agent-123",
      groupIds: ["group-a", "group-b"],
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.token).toBe("valid-token");
    expect(result.current.agent).toEqual({ name: "Agent Smith", id: "agent-123" });
    expect(result.current.agentGroupIds).toEqual(["group-a", "group-b"]);
    expect(result.current.error).toBeNull();
  });

  it("clears token and shows error when validation fails (no redirect loop)", async () => {
    mockExtractToken.mockReturnValue("bad-token");
    mockValidateToken.mockRejectedValue(new Error("Token validation failed with status 401"));

    const { result } = renderHook(() => useAuth());

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

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Authentication failed");
  });
});
