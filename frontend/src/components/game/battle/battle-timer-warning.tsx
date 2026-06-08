"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BattleTimerWarningProps {
  open: boolean;
  secondsLeft: number;
  onDismiss: () => void;
}

export default function BattleTimerWarning({
  open,
  secondsLeft,
  onDismiss,
}: BattleTimerWarningProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[min(24rem,calc(100vw-2rem))]"
        >
          <div className="rounded-xl border-2 border-amber-500/60 bg-amber-950/95 backdrop-blur-md shadow-lg shadow-amber-500/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-amber-100">时间不足！</p>
                <p className="text-sm text-amber-200/80 mt-0.5">
                  还剩 <span className="font-mono font-bold text-amber-300">{secondsLeft}</span>{" "}
                  秒，超时将自动结束回合
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-300 hover:text-amber-100 shrink-0 h-8"
                onClick={onDismiss}
              >
                知道了
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
