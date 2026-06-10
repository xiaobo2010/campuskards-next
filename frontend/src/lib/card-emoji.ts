import type { Card } from "@/types";

/** Returns a Unicode emoji matching the card's type, unit type, faction, and keywords. */
export function getCardEmoji(card: Card): string {
  const ct = (card.card_type || "").toLowerCase();
  const ut = (card.unit_type || "").toLowerCase();
  const faction = (card.faction_code || "").toLowerCase();

  // Unit-type based emojis
  if (ct === "character" || ct === "unit") {
    if (ut === "ranged" || ut === "artillery") return "🏹";
    if (ut === "tank" || ut === "defender") return "🛡️";
    if (ut === "flying") return "🦅";
    if (faction === "key_class") return "📚";
    if (faction === "arts_class") return "🎨";
    if (faction === "normal_class") return "👥";
    if (faction === "intl_class") return "🌍";
    if (faction === "competition_class") return "⚔️";
    return "⚔️";
  }

  // Spell / Command
  if (ct === "command" || ct === "event" || ct === "spell" || ct === "buff") {
    const effect = (card.effect_text || "").toLowerCase();
    if (effect.includes("伤害") || effect.includes("攻击")) return "💥";
    if (effect.includes("防御") || effect.includes("护盾")) return "🛡️";
    if (effect.includes("抽") && effect.includes("牌")) return "🃏";
    if (effect.includes("消灭") || effect.includes("摧毁")) return "💀";
    if (effect.includes("回复") || effect.includes("生命")) return "💚";
    if (effect.includes("沉默")) return "🔇";
    if (effect.includes("免疫")) return "✨";
    if (effect.includes("先攻")) return "⚡";
    if (effect.includes("召唤")) return "🌟";
    if (ut === "advisor" || ut === "teacher" || effect.includes("军师")) return "🎓";
    return "📜";
  }

  // Counter / Snitch
  if (ct === "counter" || ct === "snitch") {
    return "🪤";
  }

  // Fallback by faction
  if (faction === "key_class") return "📚";
  if (faction === "arts_class") return "🎨";
  if (faction === "normal_class") return "👥";
  if (faction === "intl_class") return "🌍";
  if (faction === "competition_class") return "⚔️";

  return "🃏";
}
