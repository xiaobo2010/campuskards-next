"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { Card } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeckDropZoneProps {
  /** 当前已选卡牌ID列表（有序） */
  selectedCardIds: string[];
  /** 卡牌详情映射：id → Card */
  cardMap: Record<string, Card>;
  /** 最大卡牌数 */
  maxCards: number;
  /** 各类别上限 */
  limits: { unit: number; effect: number; counter: number };
  /** 当前各类别已选数量 */
  counts: { unit: number; effect: number; counter: number };
  /** 卡牌变化回调（增/删/重排） */
  onChange: (newSelectedIds: string[]) => void;
  /** 可选：渲染在 DndContext 内的子元素（如卡牌库），用于共享拖放上下文 */
  children?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_COPIES_PER_CARD = 3;
const LIB_PREFIX = "lib-";

function getCardTypeCategory(cardType: string): "unit" | "effect" | "counter" {
  const t = cardType.toLowerCase();
  if (t === "counter") return "counter";
  if (t === "command" || t === "buff" || t === "effect" || t === "spell") return "effect";
  return "unit";
}

function slotId(index: number): string {
  return `deck-slot-${index}`;
}

function getCategoryLabel(cat: string): string {
  switch (cat) {
    case "unit":
      return "单位";
    case "effect":
      return "效果";
    case "counter":
      return "反制";
    default:
      return cat;
  }
}

// ─── Filled Slot (Sortable) ──────────────────────────────────────────────────

interface FilledSlotProps {
  id: string;
  card: Card;
  onRemove: () => void;
}

function FilledSlot({ id, card, onRemove }: FilledSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      ref={setNodeRef}
      style={style}
      className="relative flex flex-col items-center justify-center w-20 h-24 rounded-lg border border-border bg-card shadow-sm cursor-grab active:cursor-grabbing select-none"
      {...attributes}
      {...listeners}
    >
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80 transition-colors"
        aria-label={`移除 ${card.name}`}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Card thumbnail */}
      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.name}
          className="w-10 h-10 rounded object-cover mb-1"
          draggable={false}
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center mb-1 text-sm font-bold text-muted-foreground">
          {card.name.charAt(0)}
        </div>
      )}

      {/* Name */}
      <span className="text-[10px] leading-tight text-center truncate w-full px-1">
        {card.name}
      </span>

      {/* Cost */}
      <span className="text-[10px] font-semibold text-primary">
        {card.cost}
      </span>
    </motion.div>
  );
}

// ─── Empty Slot (Droppable) ───────────────────────────────────────────────────

function EmptySlot({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      ref={setNodeRef}
      className={`flex items-center justify-center w-20 h-24 rounded-lg border-2 border-dashed transition-colors ${
        isOver
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/30 bg-muted/30"
      }`}
    >
      <span className="text-2xl text-muted-foreground/50 font-light">+</span>
    </motion.div>
  );
}

// ─── Drag Overlay Card ────────────────────────────────────────────────────────

function DragOverlayCard({ card }: { card: Card }) {
  return (
    <div className="flex flex-col items-center justify-center w-20 h-24 rounded-lg border border-primary bg-card shadow-lg ring-2 ring-primary/30">
      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.name}
          className="w-10 h-10 rounded object-cover mb-1"
          draggable={false}
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center mb-1 text-sm font-bold text-muted-foreground">
          {card.name.charAt(0)}
        </div>
      )}
      <span className="text-[10px] leading-tight text-center truncate w-full px-1">
        {card.name}
      </span>
      <span className="text-[10px] font-semibold text-primary">
        {card.cost}
      </span>
    </div>
  );
}

// ─── Library Card (Draggable) ─────────────────────────────────────────────────

export function DeckLibraryCard({
  card,
  isSelected,
  copyCount,
  onClick,
}: {
  card: Card;
  isSelected: boolean;
  copyCount: number;
  onClick: () => void;
}) {
  const cat = getCardTypeCategory(card.card_type);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${LIB_PREFIX}${card.id}`,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`relative p-2 rounded-lg border cursor-pointer transition-all select-none ${
        cat === "unit"
          ? "bg-emerald-950/30"
          : cat === "effect"
            ? "bg-blue-950/30"
            : "bg-amber-950/30"
      } ${isSelected ? "border-emerald-500 ring-1 ring-emerald-500/50" : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-500"}`}
      {...attributes}
      {...listeners}
    >
      <p className="text-xs font-medium text-zinc-200 truncate">{card.name}</p>
      <p className="text-[10px] text-zinc-500">
        {cat === "unit" ? "🐾" : cat === "effect" ? "✨" : "🛡️"}{" "}
        {card.faction_code} · 💰{card.cost}
      </p>
      {copyCount > 0 && (
        <div className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-emerald-500 flex items-center justify-center">
          <span className="text-white text-[8px] font-bold">{copyCount}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_SLOT_ID = "deck-empty-slot";

function DeckDropZone({
  selectedCardIds,
  cardMap,
  maxCards,
  limits,
  counts,
  onChange,
  children,
}: DeckDropZoneProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const canAddMore = selectedCardIds.length < maxCards;

  // Validate if a card can be added
  const validateCard = useCallback(
    (cardId: string): boolean => {
      const card = cardMap[cardId];
      if (!card) {
        toast.error("卡牌不存在");
        return false;
      }

      const copyCount = selectedCardIds.filter((id) => id === cardId).length;
      if (copyCount >= MAX_COPIES_PER_CARD) {
        toast.error(`「${card.name}」已达 ${MAX_COPIES_PER_CARD} 张上限`);
        return false;
      }

      // Max cards check
      if (selectedCardIds.length >= maxCards) {
        toast.error(`卡组已满（上限 ${maxCards} 张）`);
        return false;
      }

      // Category limit check
      const category = getCardTypeCategory(card.card_type);
      if (counts[category] >= limits[category]) {
        toast.error(
          `${getCategoryLabel(category)}卡已达上限（${limits[category]} 张）`
        );
        return false;
      }

      return true;
    },
    [selectedCardIds, cardMap, maxCards, limits, counts]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could add hover indicators here if needed
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);

      const isDeckSlot = (id: string) => id.startsWith("deck-slot-");
      const slotIndex = (id: string) => parseInt(id.replace("deck-slot-", ""), 10);

      // Case 1: Reordering within the deck
      if (isDeckSlot(activeIdStr) && isDeckSlot(overIdStr)) {
        const oldIndex = slotIndex(activeIdStr);
        const newIndex = slotIndex(overIdStr);
        if (oldIndex !== newIndex && !Number.isNaN(oldIndex) && !Number.isNaN(newIndex)) {
          onChange(arrayMove(selectedCardIds, oldIndex, newIndex));
        }
        return;
      }

      // Case 2: Dragging from library into the deck
      if (activeIdStr.startsWith(LIB_PREFIX)) {
        const cardId = activeIdStr.slice(LIB_PREFIX.length);
        if (
          overIdStr === EMPTY_SLOT_ID ||
          isDeckSlot(overIdStr)
        ) {
          if (!validateCard(cardId)) return;
          if (isDeckSlot(overIdStr)) {
            const insertIndex = slotIndex(overIdStr);
            const newIds = [...selectedCardIds];
            newIds.splice(insertIndex, 0, cardId);
            onChange(newIds);
          } else {
            onChange([...selectedCardIds, cardId]);
          }
        }
      }
    },
    [selectedCardIds, onChange, validateCard]
  );

  // Handle card removal via click
  const handleRemoveCard = useCallback(
    (index: number) => {
      onChange(selectedCardIds.filter((_, i) => i !== index));
    },
    [selectedCardIds, onChange]
  );

  const activeCard = useMemo(() => {
    if (!activeId) return null;
    if (activeId.startsWith(LIB_PREFIX)) {
      return cardMap[activeId.slice(LIB_PREFIX.length)] ?? null;
    }
    if (activeId.startsWith("deck-slot-")) {
      const idx = parseInt(activeId.replace("deck-slot-", ""), 10);
      const cardId = selectedCardIds[idx];
      return cardId ? (cardMap[cardId] ?? null) : null;
    }
    return null;
  }, [activeId, cardMap, selectedCardIds]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full">
        {/* Drop zone container */}
        <div
          className="w-full pb-2"
          role="region"
          aria-label="卡组卡槽区域"
        >
          <div className="flex flex-wrap items-start gap-2 px-2 py-2">
            <SortableContext
              items={selectedCardIds.map((_, i) => slotId(i))}
              strategy={rectSortingStrategy}
            >
              <AnimatePresence mode="popLayout">
                {selectedCardIds.map((cardId, index) => {
                  const card = cardMap[cardId];
                  if (!card) return null;
                  return (
                    <FilledSlot
                      key={`${cardId}-${index}`}
                      id={slotId(index)}
                      card={card}
                      onRemove={() => handleRemoveCard(index)}
                    />
                  );
                })}
              </AnimatePresence>
            {/* Empty "add" slot — shown when under max */}
            <AnimatePresence mode="popLayout">
              {canAddMore && <EmptySlot key={EMPTY_SLOT_ID} id={EMPTY_SLOT_ID} />}
            </AnimatePresence>
            </SortableContext>
          </div>
        </div>

        {/* Deck stats bar */}
        <div className="flex items-center gap-4 px-2 py-1 text-xs text-muted-foreground">
          <span>
            {selectedCardIds.length}/{maxCards} 张
          </span>
          <span>
            单位 {counts.unit}/{limits.unit}
          </span>
          <span>
            效果 {counts.effect}/{limits.effect}
          </span>
          <span>
            反制 {counts.counter}/{limits.counter}
          </span>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeCard ? <DragOverlayCard card={activeCard} /> : null}
      </DragOverlay>

      {/* Children (card library, etc.) rendered inside DndContext */}
      {children}
    </DndContext>
  );
}

export { DeckDropZone };
