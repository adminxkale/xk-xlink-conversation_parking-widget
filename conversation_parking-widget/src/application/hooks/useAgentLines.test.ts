import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAgentLines } from "./useAgentLines";
import type { Line } from "../../domain/entities/line";

vi.mock("../../infrastructure/adapters/lines.adapter", () => ({
  fetchGroupPhones: vi.fn(),
  fetchChannels: vi.fn(),
}));

import {
  fetchGroupPhones,
  fetchChannels,
} from "../../infrastructure/adapters/lines.adapter";

const mockFetchGroupPhones = vi.mocked(fetchGroupPhones);
const mockFetchChannels = vi.mocked(fetchChannels);

const lineA: Line = {
  id: "l1",
  number: "Line A",
  phone_number_id: "pn1",
  phone_number: "+1111",
  groups: ["g1"],
};

const lineB: Line = {
  id: "l2",
  number: "Line B",
  phone_number_id: "pn2",
  phone_number: "+2222",
  groups: ["g2"],
};

describe("useAgentLines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays in loading state when agentGroupIds is null", () => {
    const { result } = renderHook(() => useAgentLines(null));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.lines).toEqual([]);
    expect(result.current.selectedLineId).toBeNull();
  });

  it("fetches group phones and auto-selects first line", async () => {
    mockFetchGroupPhones.mockImplementation((gid: string) =>
      Promise.resolve(gid === "g1" ? [lineA] : [lineB])
    );

    const { result } = renderHook(() => useAgentLines(["g1", "g2"]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchGroupPhones).toHaveBeenCalledWith("g1");
    expect(mockFetchGroupPhones).toHaveBeenCalledWith("g2");
    expect(result.current.lines).toHaveLength(2);
    expect(result.current.selectedLineId).toBe("l1");
    expect(result.current.error).toBeNull();
  });

  it("falls back to fetchChannels when agentGroupIds is empty", async () => {
    mockFetchChannels.mockResolvedValue([lineA]);

    const { result } = renderHook(() => useAgentLines([]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchChannels).toHaveBeenCalled();
    expect(mockFetchGroupPhones).not.toHaveBeenCalled();
    expect(result.current.lines).toEqual([lineA]);
    expect(result.current.selectedLineId).toBe("l1");
  });

  it("sets error when fetch fails", async () => {
    mockFetchGroupPhones.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAgentLines(["g1"]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(
      "No se pudieron cargar las líneas: todos los grupos fallaron"
    );
    expect(result.current.lines).toEqual([]);
  });

  it("allows changing selected line via setSelectedLineId", async () => {
    mockFetchGroupPhones.mockResolvedValue([lineA, lineB]);

    const { result } = renderHook(() => useAgentLines(["g1"]));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedLineId).toBe("l1");

    act(() => {
      result.current.setSelectedLineId("l2");
    });

    expect(result.current.selectedLineId).toBe("l2");
  });
});
