"use client";

import React, { useMemo, useCallback, useState } from "react";
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
  horizontalListSortingStrategy,
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

function getCardTypeCategory(cardType: string): "unit" | "effect" | "counter" {
  if (cardType === "unit") return "unit";
  if (cardType === "effect") return "effect";
  return "counter";
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
  onRemove: (id: string) => void;
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
          onRemove(id);
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

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_SLOT_ID = "deck-empty-slot";
const DROP_ZONE_ID = "deck-drop-zone";

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

      // Duplicate check
      if (selectedCardIds.includes(cardId)) {
        toast.error(`「${card.name}」已在卡组中`);
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

      // Case 1: Reordering within the deck (sortable → sortable)
      if (
        selectedCardIds.includes(activeIdStr) &&
        selectedCardIds.includes(overIdStr)
      ) {
        if (activeIdStr !== overIdStr) {
          const oldIndex = selectedCardIds.indexOf(activeIdStr);
          const newIndex = selectedCardIds.indexOf(overIdStr);
          onChange(arrayMove(selectedCardIds, oldIndex, newIndex));
        }
        return;
      }

      // Case 2: Dragging an existing card out of the deck (no valid over target)
      if (selectedCardIds.includes(activeIdStr) && !over) {
        onChange(selectedCardIds.filter((id) => id !== activeIdStr));
        return;
      }

      // Case 3: Dragging external card into the deck
      if (
        !selectedCardIds.includes(activeIdStr) &&
        (overIdStr === EMPTY_SLOT_ID ||
          overIdStr === DROP_ZONE_ID ||
          selectedCardIds.includes(overIdStr))
      ) {
        if (!validateCard(activeIdStr)) return;

        // If dropped on an existing card, insert before it
        if (selectedCardIds.includes(overIdStr)) {
          const insertIndex = selectedCardIds.indexOf(overIdStr);
          const newIds = [...selectedCardIds];
          newIds.splice(insertIndex, 0, activeIdStr);
          onChange(newIds);
        } else {
          // Append to end
          onChange([...selectedCardIds, activeIdStr]);
        }
      }
    },
    [selectedCardIds, onChange, validateCard]
  );

  // Handle card removal via click
  const handleRemoveCard = useCallback(
    (cardId: string) => {
      onChange(selectedCardIds.filter((id) => id !== cardId));
    },
    [selectedCardIds, onChange]
  );

  // Active card for DragOverlay
  const activeCard = activeId ? cardMap[activeId] : null;

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
          className="w-full overflow-x-auto pb-2"
          role="region"
          aria-label="卡组卡槽区域"
        >
          <div className="flex items-center gap-2 min-w-min px-2 py-2">
            <SortableContext
              items={selectedCardIds}
              strategy={horizontalListSortingStrategy}
            >
              <AnimatePresence mode="popLayout">
                {/* Filled slots */}
                {selectedCardIds.map((cardId) => {
                  const card = cardMap[cardId];
                  if (!card) return null;
                  return (
                    <FilledSlot
                      key={cardId}
                      id={cardId}
                      card={card}
                      onRemove={handleRemoveCard}
                    />
                  );
                })}
              </AnimatePresence>
            </SortableContext>

            {/* Empty "add" slot — shown when under max */}
            <AnimatePresence mode="popLayout">
              {canAddMore && <EmptySlot key={EMPTY_SLOT_ID} id={EMPTY_SLOT_ID} />}
            </AnimatePresence>
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
