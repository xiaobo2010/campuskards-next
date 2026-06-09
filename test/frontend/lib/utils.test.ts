/**
 * Tests for frontend utility functions.
 *
 * Run with: npx vitest run ../test/frontend/
 * (from the frontend/ directory, after npm install -D vitest)
 */
import { describe, it, expect } from "vitest";

// ---------- cn() utility (classnames merge) ----------

/**
 * Simplified version of the cn() utility used in the frontend.
 * The real version uses clsx + tailwind-merge.
 */
function cn(...inputs: (string | undefined | null | false | Record<string, boolean | undefined | null>)[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string") {
      classes.push(input);
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}

describe("cn (classnames)", () => {
  it("merges string classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("handles object syntax", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });
});

// ---------- Rarity / Faction label resolution ----------

describe("Label resolution patterns", () => {
  const RARITY_LABEL: Record<string, string> = {
    common: "普通", uncommon: "稀有", rare: "史诗", epic: "传说", legendary: "传奇",
  };

  const FACTION_LABEL: Record<string, string> = {
    key_class: "重点班", art_club: "艺体班", sports: "体育", student_council: "学生会", science: "科学",
  };

  it("resolves rarity labels", () => {
    expect(RARITY_LABEL["common"]).toBe("普通");
    expect(RARITY_LABEL["legendary"]).toBe("传奇");
    expect(RARITY_LABEL["unknown"]).toBeUndefined();
  });

  it("resolves faction labels", () => {
    expect(FACTION_LABEL["key_class"]).toBe("重点班");
    expect(FACTION_LABEL["science"]).toBe("科学");
  });

  it("handles fallback for unknown factions", () => {
    const code = "unknown_faction";
    expect(FACTION_LABEL[code] ?? code).toBe("unknown_faction");
  });
});

// ---------- Number formatting ----------

describe("Number formatting", () => {
  it("formats ELO delta with sign", () => {
    const fmt = (n: number) => `${n > 0 ? "+" : ""}${n}`;
    expect(fmt(24)).toBe("+24");
    expect(fmt(-12)).toBe("-12");
    expect(fmt(0)).toBe("0");
  });

  it("calculates win rate percentage", () => {
    const winRate = (wins: number, total: number) =>
      total > 0 ? Math.round((wins / total) * 100) : 0;

    expect(winRate(20, 32)).toBe(63);
    expect(winRate(0, 10)).toBe(0);
    expect(winRate(5, 0)).toBe(0);
    expect(winRate(10, 10)).toBe(100);
  });
});

// ---------- Object/collection helpers ----------

describe("Collection helpers", () => {
  it("builds owned set from array", () => {
    const owned: string[] = ["c1", "c3", "c5"];
    const ownedSet = new Set(owned);
    expect(ownedSet.size).toBe(3);
    expect(ownedSet.has("c1")).toBe(true);
    expect(ownedSet.has("c2")).toBe(false);
  });

  it("filters items by search term", () => {
    const cards = [
      { id: "c1", name: "学霸小明" },
      { id: "c2", name: "画社小红" },
      { id: "c3", name: "体育小刚" },
    ];
    const search = "小";
    const filtered = cards.filter(c => c.name.includes(search));
    expect(filtered).toHaveLength(3);

    const search2 = "明";
    const filtered2 = cards.filter(c => c.name.includes(search2));
    expect(filtered2).toHaveLength(1);
    expect(filtered2[0].id).toBe("c1");
  });
});
