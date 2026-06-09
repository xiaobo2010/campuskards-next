"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import type { BattleUnit, PendingChoicePayload } from "@/types";
import { cn } from "@/lib/utils";

interface DiscardChoiceDialogProps {
  pending: PendingChoicePayload;
  hand: BattleUnit[];
  open: boolean;
  selectedUids: string[];
  onToggle: (uid: string) => void;
  onConfirm: () => void;
}

export default function DiscardChoiceDialog({
  pending,
  hand,
  open,
  selectedUids,
  onToggle,
  onConfirm,
}: DiscardChoiceDialogProps) {
  if (!open || pending.context !== "discard") return null;
  const need = pending.discard_count ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-900/95 shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">选择要弃置的牌</p>
              <p className="text-xs text-zinc-500">
                已选 {selectedUids.length}/{need}
                {pending.source_name && ` · ${pending.source_name}`}
              </p>
            </div>
          </div>
          <div className="p-4 flex flex-wrap gap-2 justify-center max-h-48 overflow-y-auto">
            {hand.map((card) => {
              const picked = selectedUids.includes(card.uid);
              return (
                <button
                  key={card.uid}
                  type="button"
                  onClick={() => onToggle(card.uid)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-xs text-left max-w-[8rem] truncate transition-colors",
                    picked
                      ? "border-amber-400 bg-amber-950/40 text-amber-100"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-amber-500/50"
                  )}
                >
                  {card.name}
                </button>
              );
            })}
          </div>
          <div className="px-4 pb-4">
            <button
              type="button"
              disabled={selectedUids.length !== need}
              onClick={onConfirm}
              className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white"
            >
              确认弃牌
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
