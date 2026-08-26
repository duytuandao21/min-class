import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireTeacher: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { startLessonSessionAction } from "./session-actions";

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
        join_code: "ABC234",
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
