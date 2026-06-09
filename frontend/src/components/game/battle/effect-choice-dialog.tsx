"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EffectChoiceOption, PendingChoicePayload } from "@/types";
import { branchNeedsTarget } from "@/lib/effect-choice-utils";
import { cn } from "@/lib/utils";

interface EffectChoiceDialogProps {
  pending: PendingChoicePayload;
  open: boolean;
  selectedOptionId: string | null;
  awaitingTarget: boolean;
  onSelectOption: (option: EffectChoiceOption) => void;
  onCancelSelection: () => void;
}

const CONTEXT_LABEL: Record<string, string> = {
  spell: "法术抉择",
  deploy_battlecry: "出场抉择",
  ability: "能力抉择",
};

export default function EffectChoiceDialog({
  pending,
  open,
  selectedOptionId,
  awaitingTarget,
  onSelectOption,
  onCancelSelection,
}: EffectChoiceDialogProps) {
  if (!open) return null;

  const selected = pending.options.find((o) => o.id === selectedOptionId);

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
          exit={{ y: 24, opacity: 0 }}
          className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-zinc-900/95 shadow-2xl shadow-purple-900/30 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-800 bg-gradient-to-r from-purple-950/50 to-zinc-900">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {CONTEXT_LABEL[pending.context] ?? "效果抉择"}
                </p>
                <p className="text-xs text-zinc-500">{pending.source_name}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {awaitingTarget && selected ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                  <Target className="w-4 h-4" />
                  请选择目标
                </div>
                <p className="text-xs text-zinc-400">{selected.label}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 h-7"
                  onClick={onCancelSelection}
                >
                  重新选择
                </Button>
              </div>
            ) : (
              pending.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectOption(option)}
                  className={cn(
                    "w-full text-left rounded-xl border px-3 py-2.5 transition-colors",
                    "border-zinc-700/80 bg-zinc-800/50 hover:border-purple-500/50 hover:bg-purple-950/20",
                    selectedOptionId === option.id && "border-purple-400 bg-purple-950/30"
                  )}
                >
                  <p className="text-sm text-zinc-100">{option.label}</p>
                  {branchNeedsTarget(option.branch_text) && (
                    <p className="text-[10px] text-amber-400/80 mt-0.5">需要选择目标</p>
                  )}
                </button>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
