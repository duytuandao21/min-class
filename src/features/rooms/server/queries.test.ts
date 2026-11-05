import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), requireTeacher: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));

import { getTeacherRoom } from "./queries";

const roomId = "fe100000-0000-4000-8000-000000000001";
const otherRoomId = "fe100000-0000-4000-8000-000000000002";
const lessonId = "fe200000-0000-4000-8000-000000000001";
const courseSectionId = "fe300000-0000-4000-8000-000000000001";
const subjectId = "fe400000-0000-4000-8000-000000000001";
const chapterId = "fe500000-0000-4000-8000-000000000001";

function clientFixture(activeError = false) {
  const queries: { table: string; select: string; filters: unknown[][] }[] = [];
  function from(table: string) {
    const query = { table, select: "", filters: [] as unknown[][] };
    queries.push(query);
    function result(): { data: unknown; error: { code: string } | null } {
      if (table === "rooms" && query.select === "id, title, started_at") {
        return activeError ? { data: null, error: { code: "42501" } } : { data: [
          { id: roomId, title: "Chapter A", started_at: "2026-11-05T10:00:00Z" },
          { id: otherRoomId, title: "Chapter B", started_at: "2026-11-05T10:01:00Z" },
        ], error: null };
      }
      const rows: Record<string, unknown> = {
        rooms: { id: roomId, title: "Chapter A", status: "ACTIVE", started_at: "2026-11-05T10:00:00Z", teaching_section: 0, released_through: 0, lesson_id: lessonId, course_section_id: courseSectionId, chapter_id: chapterId },
        session_lessons: [{ lesson_id: lessonId, teaching_section: 0, released_through: 0 }],
        course_sections: { id: courseSectionId, subject_id: subjectId },
        sections: [{ id: "fe600000-0000-4000-8000-000000000001", position: 0, type: "CONTENT", title: "Content", content_md: "# Content" }],
      };
      return { data: rows[table], error: null };
    }
    const builder = {
      select(value: string) { query.select = value; return builder; },
      eq(...filter: unknown[]) { query.filters.push(filter); return builder; },
      not(...filter: unknown[]) { query.filters.push(filter); return builder; },
      order() { return builder; },
      maybeSingle: async () => result(),
      then<TResult1 = ReturnType<typeof result>, TResult2 = never>(
        resolve?: ((value: ReturnType<typeof result>) => TResult1 | PromiseLike<TResult1>) | null,
        reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return builder;
  }
  const rpc = vi.fn(async (name: string) => ({
    data: name === "get_teacher_session_attendance"
      ? { rosterCount: 2, joinedCount: 1, absentCount: 1, absentMssvs: ["SV002"] }
      : [{ lesson_id: lessonId, lesson_title: "Lesson A", chapter_name: "Chapter A" }],
    error: null,
  }));
  return { client: { from, rpc }, queries };
}

describe("Teacher Dashboard with multiple ACTIVE Chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacher.mockResolvedValue({ id: "teacher" });
  });

  it("reads only sibling ACTIVE Chapter metadata and keeps selected Lesson progress", async () => {
    const fixture = clientFixture();
    mocks.createClient.mockResolvedValue(fixture.client);
    const result = await getTeacherRoom(roomId, lessonId);
    expect(result?.activeChapterSessions.map((session) => session.id)).toEqual([roomId, otherRoomId]);
    expect(result?.selectedLessonId).toBe(lessonId);
    expect(result?.teaching_section).toBe(0);
    expect(result?.lessonContext).toEqual({ courseSectionId, subjectId });
    const activeQuery = fixture.queries.find((query) => query.select === "id, title, started_at");
    expect(activeQuery?.filters).toContainEqual(["course_section_id", courseSectionId]);
    expect(activeQuery?.filters).toContainEqual(["status", "ACTIVE"]);
    expect(activeQuery?.filters).toContainEqual(["chapter_id", "is", null]);
  });

  it("does not render unvalidated sibling data on query failure", async () => {
    mocks.createClient.mockResolvedValue(clientFixture(true).client);
    expect(await getTeacherRoom(roomId)).toBeNull();
  });

  it("requires Teacher identity before querying Session metadata", async () => {
    mocks.requireTeacher.mockRejectedValue(new Error("Teacher account required"));
    await expect(getTeacherRoom(roomId)).rejects.toThrow("Teacher account required");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
