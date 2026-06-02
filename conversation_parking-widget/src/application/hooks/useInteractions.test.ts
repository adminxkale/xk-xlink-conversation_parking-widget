import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useInteractions } from "./useInteractions";
import type { Interaction } from "../../domain/entities/interaction";

const fakeInteractions: Interaction[] = [
  {
    id: "c1",
    originLine: "+5730012",
    destinationLine: "+5730099",
    startTimestamp: new Date().toISOString(),
    isParked: true,
    agentId: "agent-123",
    agentName: "Test Agent",
    queueId: "queue-1",
  },
  {
    id: "c2",
    originLine: "+5730012",
    destinationLine: "+5730088",
    startTimestamp: new Date().toISOString(),
    isParked: true,
    agentId: "agent-123",
    agentName: "Test Agent",
    queueId: "queue-2",
  },
];

const mockGetInteractions = vi.fn();
const mockUnparkInteraction = vi.fn();

vi.mock("../../infrastructure/config/service-registry", () => ({
  getInteractionService: () => ({
    getInteractions: mockGetInteractions,
    unparkInteraction: mockUnparkInteraction,
  }),
}));

describe("useInteractions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInteractions.mockResolvedValue(fakeInteractions);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch when agentId is null", () => {
    const { result } = renderHook(() => useInteractions(null, null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.interactions).toEqual([]);
    expect(mockGetInteractions).not.toHaveBeenCalled();
  });

  it("fetches interactions when agentId is provided", async () => {
    const { result } = renderHook(() => useInteractions("agent-123", "test-token"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetInteractions).toHaveBeenCalledWith("agent-123");
    expect(result.current.interactions).toEqual(fakeInteractions);
    expect(result.current.error).toBeNull();
  });

  it("sets error when fetch fails", async () => {
    mockGetInteractions.mockRejectedValue(new Error("Service down"));

    const { result } = renderHook(() => useInteractions("agent-123", "test-token"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Service down");
    expect(result.current.interactions).toEqual([]);
  });

  it("unpark calls unparkInteraction with correct params", async () => {
    const unparked: Interaction = { ...fakeInteractions[0], isParked: false };
    mockUnparkInteraction.mockResolvedValue(unparked);

    const { result } = renderHook(() => useInteractions("agent-123", "test-token"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // After unpark succeeds, fetchInteractions is called again — return updated list
    mockGetInteractions.mockResolvedValue([
      { ...fakeInteractions[0], isParked: false },
      fakeInteractions[1],
    ]);

    await act(async () => {
      await result.current.unpark("c1");
    });

    expect(mockUnparkInteraction).toHaveBeenCalledWith({
      id: "c1",
      business: "+5730012",
      client: "+5730099",
      agentId: "agent-123",
      agentName: "Test Agent",
      queueId: "queue-1",
      token: "test-token",
    });
    const updated = result.current.interactions.find((i) => i.id === "c1");
    expect(updated?.isParked).toBe(false);
  });

  it("unpark does nothing for non-parked interactions", async () => {
    const mixedInteractions = [
      { ...fakeInteractions[0], isParked: false },
      fakeInteractions[1],
    ];
    mockGetInteractions.mockResolvedValue(mixedInteractions);

    const { result } = renderHook(() => useInteractions("agent-123", "test-token"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unpark("c1");
    });

    expect(mockUnparkInteraction).not.toHaveBeenCalled();
  });

  it("retry re-fetches interactions", async () => {
    mockGetInteractions.mockRejectedValueOnce(new Error("Fail"));

    const { result } = renderHook(() => useInteractions("agent-123", "test-token"));

    await waitFor(() => {
      expect(result.current.error).toBe("Fail");
    });

    mockGetInteractions.mockResolvedValue(fakeInteractions);

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.interactions).toEqual(fakeInteractions);
    expect(result.current.error).toBeNull();
  });
});
