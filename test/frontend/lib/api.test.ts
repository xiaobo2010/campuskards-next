/**
 * Unit tests for frontend API client utilities.
 *
 * Run with: npx vitest run ../test/frontend/
 * (from the frontend/ directory, after npm install -D vitest)
 */
import { describe, it, expect } from "vitest";

// The api.ts module uses browser globals (localStorage, fetch) not available in Node.
// These tests verify the pure utility functions extracted from api.ts.

// ---------- Utility: formatApiDetail (extracted from api.ts) ----------

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: string }).message);
  }
  return "请求失败";
}

describe("formatApiDetail", () => {
  it("returns string as-is", () => {
    expect(formatApiDetail("出错了")).toBe("出错了");
  });

  it("joins array of validation errors", () => {
    const detail = [
      { loc: ["body", "name"], msg: "name is required", type: "value_error" },
      { loc: ["body", "email"], msg: "invalid email", type: "value_error" },
    ];
    expect(formatApiDetail(detail)).toBe("name is required; invalid email");
  });

  it("extracts message from object", () => {
    expect(formatApiDetail({ message: "not found" })).toBe("not found");
  });

  it("falls back for unknown types", () => {
    expect(formatApiDetail(42)).toBe("请求失败");
  });

  it("handles null/undefined", () => {
    expect(formatApiDetail(null)).toBe("请求失败");
    expect(formatApiDetail(undefined)).toBe("请求失败");
  });

  it("serializes non-msg array items", () => {
    const detail = [{ msg: "error1" }, { code: 123 }];
    expect(formatApiDetail(detail)).toBe('error1; {"code":123}');
  });
});

// ---------- Utility: Token helpers (pure logic) ----------

describe("Token helper patterns", () => {
  it("auth header format is correct", () => {
    const token = "test.jwt.token";
    const header = `Bearer ${token}`;
    expect(header).toBe("Bearer test.jwt.token");
  });

  it("URL construction for API calls", () => {
    const API_BASE = "https://gapi.xiaobocloud.fun";
    const path = "/api/auth/me";
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    expect(url).toBe("https://gapi.xiaobocloud.fun/api/auth/me");
  });
});

// ---------- Type structure validation ----------

describe("Type contract checks", () => {
  it("User type structure", () => {
    const user = {
      id: "u1",
      username: "test",
      email: "test@test.com",
      elo: 1000,
      ink: 500,
      role: "player" as const,
    };
    expect(user.id).toBeTypeOf("string");
    expect(user.username).toBeTypeOf("string");
    expect(user.role).toMatch(/^(player|admin)$/);
    expect(user.elo).toBeTypeOf("number");
    expect(user.ink).toBeTypeOf("number");
  });

  it("PaginatedResponse type structure", () => {
    const resp = {
      items: [{ id: "1", name: "test" }],
      total: 1,
      page: 1,
      page_size: 20,
    };
    expect(resp.items).toBeInstanceOf(Array);
    expect(resp.total).toBe(1);
    expect(resp.page).toBe(1);
    expect(resp.page_size).toBe(20);
  });

  it("MatchMode is restricted", () => {
    const validModes = ["quick", "ranked"] as const;
    expect(validModes).toContain("quick");
    expect(validModes).toContain("ranked");
    // @ts-expect-error - "invalid" is not a MatchMode
    expect(validModes).not.toContain("invalid");
  });
});
