import type { BattlePackDrop } from "@/types";
import type { PackResultCard } from "@/components/game/pack-opening-animation";

export function battlePackToResultCards(pack: BattlePackDrop): PackResultCard[] {
  return pack.cards.map((c, i) => ({
    name: c.name,
    rarity: c.rarity || "common",
    faction: c.faction_code || "unknown",
    id: c.card_id,
    faction_code: c.faction_code,
    slot_index: i,
    is_new: c.is_new,
  }));
}

/** Map backend pack id to animation theme id. */
export function packAnimationId(packId: string): string {
  if (packId === "basic" || packId === "advanced") return packId;
  return "battle_drop";
}
