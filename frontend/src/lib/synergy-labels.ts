/** Synergy tag labels for battle UI badges. */
export const SYNERGY_TAG_META: Record<
  string,
  { label: string; short: string; className: string; title: string }
> = {
  adjacent_synergy: {
    label: "邻位协同",
    short: "邻",
    className: "bg-cyan-900/70 text-cyan-200 border-cyan-500/40",
    title: "与同派系邻位友军相邻，力量 +1",
  },
  elite_synergy: {
    label: "重点班协同",
    short: "精",
    className: "bg-blue-900/70 text-blue-200 border-blue-500/40",
    title: "场上有 2+ 重点班单位，力量 +1",
  },
  arts_synergy: {
    label: "艺体班协同",
    short: "艺",
    className: "bg-pink-900/70 text-pink-200 border-pink-500/40",
    title: "场上有 3+ 艺体班单位，精神 +1",
  },
  mass_synergy: {
    label: "普通班协同",
    short: "普",
    className: "bg-zinc-700/70 text-zinc-200 border-zinc-500/40",
    title: "场上有 4+ 普通班单位，力量与精神 +1",
  },
  global_synergy: {
    label: "国际班协同",
    short: "际",
    className: "bg-violet-900/70 text-violet-200 border-violet-500/40",
    title: "国际班 2+ 且含其他派系，国际班力量 +1 / 其他精神 +1",
  },
  rush_synergy: {
    label: "竞赛班协同",
    short: "竞",
    className: "bg-orange-900/70 text-orange-200 border-orange-500/40",
    title: "本回合已攻击 2 次，竞赛班力量 +2",
  },
};

export function synergyTagMeta(tag: string) {
  return (
    SYNERGY_TAG_META[tag] ?? {
      label: tag,
      short: tag.slice(0, 1),
      className: "bg-zinc-800/80 text-zinc-300 border-zinc-600/40",
      title: tag,
    }
  );
}
