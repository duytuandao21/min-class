import { describe, expect, it } from "vitest";

import { mssvSchema } from "./schemas";

describe("Room join input schemas", () => {
  it.each(["A", "SV 001", "SV@001", "-"])("rejects invalid MSSV: %s", (mssv) => {
    expect(mssvSchema.safeParse(mssv).success).toBe(false);
  });

  it("normalizes a valid MSSV", () => {
    expect(mssvSchema.parse(" sv001 ")).toBe("SV001");
  });
});
