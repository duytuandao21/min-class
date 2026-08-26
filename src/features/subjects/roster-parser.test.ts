import { describe, expect, it } from "vitest";

import { MAX_ROSTER_FILE_BYTES, parseRosterText } from "./roster-parser";

describe("Course Section roster TXT parser", () => {
  it("parses and normalizes a valid TXT roster", () => {
    const result = parseRosterText(" 23110001\r\nsv-002\nSV_003 ");
    expect(result.students).toEqual(["23110001", "SV-002", "SV_003"]);
    expect(result.validCount).toBe(3);
    expect(result.canSave).toBe(true);
  });

  it("ignores empty lines", () => {
    const result = parseRosterText("23110001\n\n   \n23110002\n");
    expect(result.students).toEqual(["23110001", "23110002"]);
    expect(result.emptyLineCount).toBe(3);
    expect(result.canSave).toBe(true);
  });

  it("reports normalized duplicates with their line numbers", () => {
    const result = parseRosterText("23110001\n 23110001 \nsv002\nSV002");
    expect(result.duplicates).toEqual([
      { line: 2, mssv: "23110001", firstLine: 1 },
      { line: 4, mssv: "SV002", firstLine: 3 },
    ]);
    expect(result.validCount).toBe(2);
    expect(result.canSave).toBe(false);
  });

  it.each(["A1", "SV 001", "SV/001", "-SV001", "A".repeat(33)])("reports invalid MSSV %s", (mssv) => {
    const result = parseRosterText(mssv);
    expect(result.invalidLines).toHaveLength(1);
    expect(result.canSave).toBe(false);
  });

  it("rejects a roster exceeding the file-size limit", () => {
    const result = parseRosterText("A".repeat(MAX_ROSTER_FILE_BYTES + 1));
    expect(result.fileErrors).toContain("File roster không được vượt quá 256 KB.");
    expect(result.canSave).toBe(false);
  });
});
