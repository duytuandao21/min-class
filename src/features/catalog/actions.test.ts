import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { accessPublicLessonAction, type LessonAccessState } from "./actions";

const lessonId = "af300000-0000-4000-8000-000000000001";
const sessionId = "af800000-0000-4000-8000-000000000001";
const initialState: LessonAccessState = { status: "idle" };

function lessonAccessForm(mssv: string) {
  const formData = new FormData();
  formData.set("mssv", mssv);
  return formData;
}

function anonymousSupabase(rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "student", is_anonymous: true } },
        error: null,
      }),
    },
    rpc,
  };
}

describe("accessPublicLessonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joins a LIVE Lesson with MSSV only", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ room_id: sessionId }],
      error: null,
    });
    mocks.createClient.mockResolvedValue(anonymousSupabase(rpc));

    await expect(accessPublicLessonAction(
      lessonId,
      "LIVE",
      initialState,
      lessonAccessForm("23162011"),
    )).resolves.toEqual({
      status: "success",
      message: "Đã tham gia Lesson Session.",
      sessionId,
      lessonId,
    });

    expect(rpc).toHaveBeenCalledWith("join_live_lesson", {
      p_lesson_id: lessonId,
      p_mssv: "23162011",
    });
  });

  it("reports that a Student is outside the Course Section", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0003", message: "Student is not in the Course Section." },
    });
    mocks.createClient.mockResolvedValue(anonymousSupabase(rpc));

    await expect(accessPublicLessonAction(
      lessonId,
      "LIVE",
      initialState,
      lessonAccessForm("23162099"),
    )).resolves.toEqual({
      status: "error",
      message: "Bạn không thuộc lớp học phần này",
    });
  });

  it("uses the roster message when the MSSV format is invalid", async () => {
    await expect(accessPublicLessonAction(
      lessonId,
      "LIVE",
      initialState,
      lessonAccessForm("?"),
    )).resolves.toMatchObject({
      status: "error",
      message: "Bạn không thuộc lớp học phần này",
    });

    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("keeps the ENDED Lesson review access flow separate", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        lesson_id: lessonId,
        lesson_status: "ENDED",
        session_id: sessionId,
      }],
      error: null,
    });
    mocks.createClient.mockResolvedValue(anonymousSupabase(rpc));

    await expect(accessPublicLessonAction(
      lessonId,
      "ENDED",
      initialState,
      lessonAccessForm("23162011"),
    )).resolves.toMatchObject({ status: "success", sessionId });

    expect(rpc).toHaveBeenCalledWith("access_ended_lesson_session", {
      p_lesson_id: lessonId,
      p_mssv: "23162011",
    });
  });
});
