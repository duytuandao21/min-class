import { describe, expect, it } from "vitest";

import { mssvSchema, roomCodeSchema } from "./schemas";

describe("Room join input schemas", () => {
  it.each(["BAD", "ABC01I", "ABC@23", "ABCDEFG"])("rejects invalid Room Code: %s", (code) => {
    expect(roomCodeSchema.safeParse(code).success).toBe(false);
  });

  it("normalizes a valid Room Code", () => {
    expect(roomCodeSchema.parse(" abc234 ")).toBe("ABC234");
  });

  it.each(["A", "SV 001", "SV@001", "-"])("rejects invalid MSSV: %s", (mssv) => {
    expect(mssvSchema.safeParse(mssv).success).toBe(false);
  });

  it("normalizes a valid MSSV", () => {
    expect(mssvSchema.parse(" sv001 ")).toBe("SV001");
  });
});
