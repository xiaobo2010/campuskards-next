/** Human-readable faction names (seed data codes). */
export const FACTION_LABEL: Record<string, string> = {
  key_class: "重点班",
  arts_class: "艺体班",
  normal_class: "普通班",
  intl_class: "国际班",
  competition_class: "竞赛班",
  neutral: "中立",
  // legacy / demo aliases
  art_club: "艺体班",
  sports: "体育",
  student_council: "学生会",
  science: "科学",
  elite: "精英班",
  arts: "艺术班",
  mass: "普通班",
  global: "国际班",
  rush: "竞赛班",
};

export function formatFaction(code: string | null | undefined): string {
  if (!code) return "未知势力";
  return FACTION_LABEL[code] ?? code;
}
