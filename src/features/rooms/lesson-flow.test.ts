import { describe, expect, it } from "vitest";

import {
  parseStudentLessonSnapshot,
  reconcileStudentPosition,
  type LessonSection,
} from "./lesson-flow";

const section = (position: number): LessonSection => ({
  id: `52000000-0000-0000-0000-${String(position + 1).padStart(12, "0")}`,
  position,
  type: "CONTENT",
  title: `Section ${position + 1}`,
  contentMd: `Content ${position + 1}`,
});

describe("student lesson reconciliation", () => {
  it("moves from waiting to the first section Teacher presents", () => {
    expect(reconcileStudentPosition(null, [], [section(0)])).toBe(0);
  });

  it("advances from the newest section when Teacher moves to the middle section", () => {
    expect(reconcileStudentPosition(0, [section(0)], [section(0), section(1)])).toBe(1);
  });

  it("keeps a student on an older section while browsing Previous", () => {
    expect(
      reconcileStudentPosition(0, [section(0), section(1)], [section(0), section(1), section(2)]),
    ).toBe(0);
  });

  it("reconciles a stale reconnect snapshot to the database latest section", () => {
    expect(reconcileStudentPosition(null, [], [section(0), section(1), section(2)])).toBe(2);
  });

  it("parses a waiting snapshot without inventing a section", () => {
    const snapshot = parseStudentLessonSnapshot([{
      room_id: "32000000-0000-4000-8000-000000000001",
      room_title: "Flow Room",
      room_status: "ACTIVE",
      released_through: -1,
      section_id: null,
      section_position: null,
      section_type: null,
      section_title: null,
      section_content_md: null,
    }]);

    expect(snapshot.sections).toEqual([]);
    expect(snapshot.releasedThrough).toBe(-1);
  });
});
