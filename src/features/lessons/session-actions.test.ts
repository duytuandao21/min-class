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

  it("reports a duplicate active Chapter rather than blocking the entire Course Section", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }),
    });

    await expect(startLessonSessionAction(lessonId)).resolves.toEqual({
      ok: false,
      message: "Chương của Lesson này đang LIVE. Hãy mở Dashboard hoặc tải lại trang.",
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/learn/live");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/teacher/subjects/[subjectId]/sections/[courseSectionId]", "page");
  });

  it("reports a duplicate of this Chapter only", async () => {
    mocks.createClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ error: { code: "23505" } }) });
    await expect(startChapterSessionAction({ courseSectionId, chapterId })).resolves.toEqual({
      ok: false, message: "Chương này đang LIVE. Hãy mở Dashboard hoặc tải lại trang.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("retains the empty-Chapter validation", async () => {
    mocks.createClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ error: { code: "P0001" } }) });
    await expect(startChapterSessionAction({ courseSectionId, chapterId })).resolves.toEqual({
      ok: false, message: "Chương cần có ít nhất một Lesson hợp lệ.",
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
