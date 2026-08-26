import { MSSV_PATTERN } from "@/features/rooms/schemas";

export const MAX_ROSTER_FILE_BYTES = 262_144;
export const MAX_ROSTER_STUDENTS = 2_000;

export type RosterDuplicateLine = {
  line: number;
  mssv: string;
  firstLine: number;
};

export type RosterInvalidLine = {
  line: number;
  value: string;
  reason: string;
};

export type RosterPreview = {
  students: string[];
  validCount: number;
  emptyLineCount: number;
  duplicates: RosterDuplicateLine[];
  invalidLines: RosterInvalidLine[];
  fileErrors: string[];
  canSave: boolean;
};

export function normalizeMssv(value: string): string {
  return value.trim().toUpperCase();
}

export function parseRosterText(source: string): RosterPreview {
  const fileErrors: string[] = [];
  if (new TextEncoder().encode(source).byteLength > MAX_ROSTER_FILE_BYTES) {
    fileErrors.push("File roster không được vượt quá 256 KB.");
  }

  const students: string[] = [];
  const duplicates: RosterDuplicateLine[] = [];
  const invalidLines: RosterInvalidLine[] = [];
  const firstLines = new Map<string, number>();
  let emptyLineCount = 0;

  source.split(/\r\n?|\n/).forEach((rawValue, index) => {
    const line = index + 1;
    const mssv = normalizeMssv(rawValue);
    if (!mssv) {
      emptyLineCount += 1;
      return;
    }

    if (!MSSV_PATTERN.test(mssv)) {
      invalidLines.push({
        line,
        value: rawValue.trim(),
        reason: "MSSV cần 3–32 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.",
      });
      return;
    }

    const firstLine = firstLines.get(mssv);
    if (firstLine !== undefined) {
      duplicates.push({ line, mssv, firstLine });
      return;
    }

    firstLines.set(mssv, line);
    students.push(mssv);
  });

  if (students.length > MAX_ROSTER_STUDENTS) {
    fileErrors.push(`Roster không được vượt quá ${MAX_ROSTER_STUDENTS} MSSV.`);
  }
  if (students.length === 0 && invalidLines.length === 0) {
    fileErrors.push("File roster không có MSSV.");
  }

  return {
    students,
    validCount: students.length,
    emptyLineCount,
    duplicates,
    invalidLines,
    fileErrors,
    canSave: fileErrors.length === 0 && duplicates.length === 0 && invalidLines.length === 0,
  };
}
