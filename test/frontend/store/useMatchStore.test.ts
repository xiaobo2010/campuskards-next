import { beforeEach, describe, expect, it } from "vitest";
import { useMatchStore } from "@/store/useMatchStore";

describe("useMatchStore.setCurrentGame", () => {
  beforeEach(() => {
    useMatchStore.getState().resetMatch();
  });

  it("clears stale game state when switching to a new match", () => {
    const store = useMatchStore.getState();
    store.setGameState({ turn: 5 } as never);
    store.setConnectionStatus("connected");
    store.setSelectedAttackerUid("attacker-1");

    store.setCurrentGame("match-b", null);

    const next = useMatchStore.getState();
    expect(next.currentGameId).toBe("match-b");
    expect(next.gameState).toBeNull();
    expect(next.connectionStatus).toBe("idle");
    expect(next.selectedAttackerUid).toBeNull();
  });

  it("is a no-op when the same match is set again", () => {
    const store = useMatchStore.getState();
    store.setCurrentGame("match-a", null);
    store.setGameState({ turn: 2 } as never);

    store.setCurrentGame("match-a", null);

    const next = useMatchStore.getState();
    expect(next.gameState).toEqual({ turn: 2 });
    expect(next.connectionStatus).toBe("idle");
  });
});
