import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { AuthContext } from "../../src/presentation/providers/AuthContext";
import { ConversationParkingWidget } from "../../src/presentation/components/ConversationParkingWidget";
import { AuthProvider } from "../../src/presentation/components/AuthProvider";
import type { AuthState } from "../../src/domain/entities/auth";
import type { Interaction } from "../../src/domain/entities/interaction";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("../../src/infrastructure/adapters/genesys-auth.adapter", () => ({
  extractToken: vi.fn(),
  validateToken: vi.fn(),
  clearToken: vi.fn(),
  redirectToLogin: vi.fn(),
}));

vi.mock("../../src/infrastructure/adapters/lines.adapter", () => ({
  fetchGroupPhones: vi.fn(),
  fetchChannels: vi.fn(),
}));

const mockGetInteractions = vi.fn();
const mockUnparkInteraction = vi.fn();
const mockSendTemplate = vi.fn();

vi.mock("../../src/infrastructure/config/service-registry", () => ({
  getInteractionService: () => ({
    getInteractions: mockGetInteractions,
    unparkInteraction: mockUnparkInteraction,
  }),
  getTemplateService: () => ({
    sendTemplate: mockSendTemplate,
  }),
  getNotificationService: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

import {
  extractToken,
  validateToken,
  clearToken,
  redirectToLogin,
} from "../../src/infrastructure/adapters/genesys-auth.adapter";
import {
  fetchGroupPhones,
  fetchChannels,
} from "../../src/infrastructure/adapters/lines.adapter";

const mockExtractToken = vi.mocked(extractToken);
const mockValidateToken = vi.mocked(validateToken);
const mockClearToken = vi.mocked(clearToken);
const mockRedirectToLogin = vi.mocked(redirectToLogin);
const mockFetchGroupPhones = vi.mocked(fetchGroupPhones);
const mockFetchChannels = vi.mocked(fetchChannels);

// ── Fixtures ───────────────────────────────────────────────────────

const fakeLines = [
  {
    id: "line-1",
    number: "Main Line",
    phone_number_id: "pn-1",
    phone_number: "+573001234567",
  },
];

const fakeInteractions: Interaction[] = [
  {
    id: "conv-001",
    originLine: "+573001234567",
    destinationLine: "+573017654321",
    startTimestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    isParked: true,
  },
  {
    id: "conv-002",
    originLine: "+573001234567",
    destinationLine: "+573019999999",
    startTimestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    isParked: false,
  },
];

const authenticatedState: AuthState = {
  isAuthenticated: true,
  isLoading: false,
  token: "valid-token",
  agent: { name: "Agent Smith", id: "agent-123" },
  agentGroupIds: ["group-a"],
  error: null,
};

function renderWithAuth(ui: ReactNode, authState: AuthState = authenticatedState) {
  return render(
    <AuthContext.Provider value={authState}>{ui}</AuthContext.Provider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Integration tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchGroupPhones.mockResolvedValue(fakeLines);
    mockFetchChannels.mockResolvedValue(fakeLines);
    mockGetInteractions.mockResolvedValue(fakeInteractions);
    mockSendTemplate.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1: Complete unpark flow ─────────────────────────────────
  describe("Complete unpark flow", () => {
    it("toggle → API proxy call → visual update", async () => {
      const user = userEvent.setup();

      const unparked: Interaction = { ...fakeInteractions[0], isParked: false };
      mockUnparkInteraction.mockResolvedValue(unparked);

      renderWithAuth(<ConversationParkingWidget />);

      // Wait for interactions to load
      await waitFor(() => {
        expect(screen.getByText("Parqueada")).toBeInTheDocument();
      });

      // Click the "Desparquear" button (the parked interaction's toggle)
      const unparkButton = screen.getByRole("button", {
        name: "Desparquear conversación",
      });
      await user.click(unparkButton);

      // Verify unparkInteraction was called
      await waitFor(() => {
        expect(mockUnparkInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "conv-001",
            business: "+573001234567",
            client: "+573017654321",
          })
        );
      });

      // Verify sendTemplate was NOT called (unpark no longer sends template)
      expect(mockSendTemplate).not.toHaveBeenCalled();
    });
  });

  // ── Test 2: Authentication flow ──────────────────────────────────
  describe("Authentication flow", () => {
    it("loading → token search → validation → widget access", async () => {
      mockExtractToken.mockReturnValue("test-token");
      mockValidateToken.mockResolvedValue({
        name: "Agent Smith",
        id: "agent-123",
        groupIds: ["group-a"],
      });

      render(
        <AuthProvider credentials={{ genesys_client_id: "test-id", genesys_client_secret: "test-secret", environment: "mypurecloud.com" }}>
          <ConversationParkingWidget />
        </AuthProvider>
      );

      // Initially shows loading
      expect(screen.getByText("Autenticando...")).toBeInTheDocument();

      // After auth resolves, the widget renders with the title
      await waitFor(() => {
        expect(screen.getByText("Conversation Parking Hub")).toBeInTheDocument();
      });
    });
  });

  // ── Test 3: Retry after error ────────────────────────────────────
  describe("Retry after error", () => {
    it("service error → click retry → new call", async () => {
      const user = userEvent.setup();

      // First call fails
      mockGetInteractions
        .mockRejectedValueOnce(new Error("Service unavailable"))
        .mockResolvedValueOnce(fakeInteractions);

      renderWithAuth(<ConversationParkingWidget />);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText("Service unavailable")).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole("button", { name: "Reintentar" });
      await user.click(retryButton);

      // Verify interactions load successfully after retry (check unique destination line)
      await waitFor(() => {
        expect(screen.getByText(/\+573017654321/)).toBeInTheDocument();
      });

      // getInteractions was called twice (initial + retry)
      expect(mockGetInteractions).toHaveBeenCalledTimes(2);
    });
  });
});
