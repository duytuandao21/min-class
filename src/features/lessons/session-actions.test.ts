import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireTeacher: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { startChapterSessionAction, startLessonSessionAction } from "./session-actions";

const lessonId = "af300000-0000-4000-8000-000000000001";
const sessionId = "af800000-0000-4000-8000-000000000001";

describe("startLessonSessionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacher.mockResolvedValue({ id: "teacher" });
  });

  it("starts a persistent Lesson and returns its Session id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        session_id: sessionId,
        session_status: "ACTIVE",
        started_at: "2026-08-26T01:02:03.000Z",
      }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(startLessonSessionAction(lessonId)).resolves.toEqual({ ok: true, sessionId });
    expect(rpc).toHaveBeenCalledWith("start_lesson_session", { p_lesson_id: lessonId });
  });

  it("reports duplicate active Course Section Session", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }),
    });

    await expect(startLessonSessionAction(lessonId)).resolves.toEqual({
      ok: false,
      message: "Lớp học phần này đang có một Lesson LIVE.",
    });
  });

  it("rejects an invalid Lesson id before calling Supabase", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(startLessonSessionAction("invalid")).resolves.toEqual({
      ok: false,
      message: "Lesson không hợp lệ.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("startChapterSessionAction", () => {
  const courseSectionId = "af400000-0000-4000-8000-000000000001";
  const chapterId = "af500000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacher.mockResolvedValue({ id: "teacher" });
  });

  it("starts one Chapter Session containing its Lessons", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ session_id: sessionId, session_status: "ACTIVE", started_at: "2026-09-03T01:02:03.000Z" }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(startChapterSessionAction({ courseSectionId, chapterId })).resolves.toEqual({ ok: true, sessionId });
    expect(rpc).toHaveBeenCalledWith("start_chapter_session", {
      p_course_section_id: courseSectionId,
      p_chapter_id: chapterId,
    });
  });

  it("rejects invalid Chapter input before Supabase", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });
    await expect(startChapterSessionAction({ courseSectionId, chapterId: "invalid" })).resolves.toEqual({
      ok: false,
      message: "Chương không hợp lệ.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
