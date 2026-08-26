import { describe, expect, it } from "vitest";

import { chapterInputSchema, courseSectionInputSchema, subjectInputSchema } from "./schemas";

describe("Subject management validation", () => {
  it("normalizes valid Subject input", () => {
    expect(subjectInputSchema.parse({ name: "  Mạng máy tính  ", code: " netw420 " })).toEqual({
      name: "Mạng máy tính",
      code: "NETW420",
    });
  });

  it("allows an omitted Subject code", () => {
    expect(subjectInputSchema.parse({ name: "Mạng máy tính", code: "" })).toEqual({
      name: "Mạng máy tính",
      code: undefined,
    });
  });

  it("normalizes a valid Course Section", () => {
    expect(courseSectionInputSchema.parse({ sectionCode: " 24110netw42001 ", displayName: "  Ca sáng " })).toEqual({
      sectionCode: "24110NETW42001",
      displayName: "Ca sáng",
    });
  });

  it("normalizes a valid Chapter name", () => {
    expect(chapterInputSchema.parse({ name: "  Chương 1: Giới thiệu  " })).toEqual({
      name: "Chương 1: Giới thiệu",
    });
  });

  it("rejects an empty Chapter name", () => {
    expect(chapterInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it.each(["A", "LỚP 01", "NETW/01", "-NETW01"])("rejects invalid section code %s", (sectionCode) => {
    expect(courseSectionInputSchema.safeParse({ sectionCode, displayName: "" }).success).toBe(false);
  });
});
