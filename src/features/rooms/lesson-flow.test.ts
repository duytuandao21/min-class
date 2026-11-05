import { describe, expect, it } from "vitest";

import {
  getAdjacentSectionPosition,
  getTeacherSectionViewMode,
  getStudentPresentationPosition,
  parseStudentLessonSnapshot,
  reconcileStudentPosition,
  type LessonSection,
  type StudentLessonSnapshot,
} from "./lesson-flow";
import { sortSessionLessons } from "@/features/lessons/order";

const section = (position: number): LessonSection => ({
  id: `52000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`,
  position,
  type: "CONTENT",
  title: `Section ${position + 1}`,
  contentMd: `Content ${position + 1}`,
});

describe("student lesson reconciliation", () => {
  const snapshot = (position: number, revision = position, status: "ACTIVE" | "ENDED" = "ACTIVE"): StudentLessonSnapshot => ({
    id: "32000000-0000-4000-8000-000000000001",
    title: "Lesson",
    status,
    teachingSection: position,
    releasedThrough: 2,
    presentationRevision: revision,
    sections: [section(0), section(1), section(2)],
  });

  it("moves from waiting to the first section Teacher presents", () => {
    expect(reconcileStudentPosition(null, snapshot(0), snapshot(0))).toBe(0);
  });

  it("advances from the newest section when Teacher moves to the middle section", () => {
    expect(reconcileStudentPosition(0, snapshot(0), snapshot(1))).toBe(1);
  });

  it("forces students browsing any section to the teacher's new position", () => {
    for (const studentPosition of [0, 1, 2]) {
      expect(reconcileStudentPosition(studentPosition, snapshot(2), snapshot(1, 3))).toBe(1);
    }
  });

  it("keeps independent browsing on ordinary refetches", () => {
    expect(reconcileStudentPosition(0, snapshot(2), snapshot(2))).toBe(0);
  });

  it("catches commands that moved away and back while offline, or re-present the same position", () => {
    expect(reconcileStudentPosition(0, snapshot(2, 3), snapshot(2, 5))).toBe(2);
  });

  it("initializes a returning LIVE student at the presentation pointer rather than the frontier", () => {
    expect(getStudentPresentationPosition(snapshot(0, 5))).toBe(0);
  });

  it("does not force a presentation during ended review or the transition to ENDED", () => {
    expect(reconcileStudentPosition(1, snapshot(2), snapshot(0, 5, "ENDED"))).toBe(1);
    expect(getStudentPresentationPosition(snapshot(0, 5, "ENDED"))).toBe(2);
  });

  it("does not invent a section in a waiting snapshot", () => {
    const empty = { ...snapshot(0), sections: [], releasedThrough: -1 };
    expect(getStudentPresentationPosition(empty)).toBeNull();
    expect(reconcileStudentPosition(0, snapshot(0), empty)).toBeNull();
  });

  it("parses a waiting snapshot without inventing a section", () => {
    const snapshot = parseStudentLessonSnapshot([{
      room_id: "32000000-0000-4000-8000-000000000001",
      room_title: "Flow Room",
      room_status: "ACTIVE",
      released_through: -1,
      teaching_section: 0,
      presentation_revision: 0,
      section_id: null,
      section_position: null,
      section_type: null,
      section_title: null,
      section_content_md: null,
    }]);

    expect(snapshot.sections).toEqual([]);
    expect(snapshot.releasedThrough).toBe(-1);
  });

  it("parses presentation progress and rejects invalid revisions", () => {
    const row = {
      room_id: "32000000-0000-4000-8000-000000000001", room_title: "Lesson",
      room_status: "ACTIVE", released_through: 2, teaching_section: 0, presentation_revision: 4,
      section_id: section(0).id, section_position: 0, section_type: "CONTENT",
      section_title: "Section 1", section_content_md: "Content",
    };
    expect(parseStudentLessonSnapshot([row])).toMatchObject({ teachingSection: 0, presentationRevision: 4 });
    expect(() => parseStudentLessonSnapshot([{ ...row, presentation_revision: -1 }])).toThrow();
  });
});

describe("teacher section navigation", () => {
  const sections = [section(0), section(1), section(2)];

  it("moves locally to adjacent Sections without inventing a position", () => {
    expect(getAdjacentSectionPosition(sections, 1, -1)).toBe(0);
    expect(getAdjacentSectionPosition(sections, 1, 1)).toBe(2);
    expect(getAdjacentSectionPosition(sections, 0, -1)).toBeNull();
    expect(getAdjacentSectionPosition(sections, 2, 1)).toBeNull();
  });

  it("distinguishes the teaching Section from review and preview views", () => {
    expect(getTeacherSectionViewMode(1, 1)).toBe("TEACHING");
    expect(getTeacherSectionViewMode(0, 1)).toBe("REVIEW");
    expect(getTeacherSectionViewMode(2, 1)).toBe("PREVIEW");
    expect(getTeacherSectionViewMode(2, 0, 2)).toBe("REVIEW");
  });
});

describe("Session Lesson ordering", () => {
  it("sorts numbered Lesson titles naturally without mutating the RPC result", () => {
    const lessons = [
      { lesson_id: "3", lesson_title: "Bài 10 - Tổng kết" },
      { lesson_id: "2", lesson_title: "Bài 2 - Mảng động" },
      { lesson_id: "1", lesson_title: "Bài 1 - Mảng tĩnh" },
    ];

    expect(sortSessionLessons(lessons).map((lesson) => lesson.lesson_title)).toEqual([
      "Bài 1 - Mảng tĩnh",
      "Bài 2 - Mảng động",
      "Bài 10 - Tổng kết",
    ]);
    expect(lessons[0].lesson_title).toBe("Bài 10 - Tổng kết");
  });
});
