"use client";

import { useCallback, useEffect, useState } from "react";

const TURN_LIMIT = 100;
const WARNING_AT = 20;

export function useTurnTimer(isMyTurn: boolean) {
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TURN_LIMIT);
  const [showWarning, setShowWarning] = useState(false);

  const syncFromServer = useCallback(
    (payload: {
      turn_deadline_ts?: number | null;
      timer_remaining?: number;
      timer?: number;
    }) => {
      if (payload.turn_deadline_ts) {
        setDeadlineTs(payload.turn_deadline_ts * 1000);
      } else if (payload.timer_remaining != null) {
        setDeadlineTs(Date.now() + payload.timer_remaining * 1000);
      } else if (payload.timer != null) {
        setDeadlineTs(Date.now() + payload.timer * 1000);
      }
    },
    []
  );

  const onTurnStart = useCallback(
    (payload: {
      turn_deadline_ts?: number;
      timer_remaining?: number;
      timer?: number;
    }) => {
      setShowWarning(false);
      syncFromServer(payload);
    },
    [syncFromServer]
  );

  const onTimerWarning = useCallback(() => {
    setShowWarning(true);
  }, []);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!deadlineTs) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000));
      setSecondsLeft(left);
      if (isMyTurn && left > 0 && left <= WARNING_AT) {
        setShowWarning(true);
      }
      if (left <= 0) {
        setShowWarning(false);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadlineTs, isMyTurn]);

  return {
    secondsLeft,
    turnLimit: TURN_LIMIT,
    warningAt: WARNING_AT,
    showWarning: showWarning && isMyTurn,
    onTurnStart,
    onTimerWarning,
    dismissWarning,
    syncFromServer,
  };
}

export function formatMatchElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
