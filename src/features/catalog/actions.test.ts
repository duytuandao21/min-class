import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { accessPublicLessonAction, type LessonAccessState } from "./actions";

const lessonId = "af300000-0000-4000-8000-000000000001";
const initialState: LessonAccessState = { status: "idle" };

function lessonAccessForm(mssv: string, sessionCode: string) {
  const formData = new FormData();
  formData.set("mssv", mssv);
  formData.set("sessionCode", sessionCode);
  return formData;
}

describe("accessPublicLessonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports that a Student is outside the Course Section when the code is correct", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0003", message: "Student is not in the Course Section." },
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "student", is_anonymous: true } },
          error: null,
        }),
      },
      rpc,
    });

    await expect(accessPublicLessonAction(
      lessonId,
      initialState,
      lessonAccessForm("23162099", "ABC234"),
    )).resolves.toEqual({
      status: "error",
      message: "Bạn không thuộc lớp học phần này",
    });
  });

  it("reports an incorrect Lesson Session Code before roster membership", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "Lesson Session Code is incorrect." },
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "student", is_anonymous: true } },
          error: null,
        }),
      },
      rpc,
    });

    await expect(accessPublicLessonAction(
      lessonId,
      initialState,
      lessonAccessForm("23162011", "XYZ234"),
    )).resolves.toEqual({
      status: "error",
      message: "Lesson Session Code chưa đúng",
    });
  });

  it("uses the same code message when the code format is invalid", async () => {
    await expect(accessPublicLessonAction(
      lessonId,
      initialState,
      lessonAccessForm("23162011", "000000"),
    )).resolves.toMatchObject({
      status: "error",
      message: "Lesson Session Code chưa đúng",
    });

    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("uses the roster message when the MSSV format is invalid", async () => {
    await expect(accessPublicLessonAction(
      lessonId,
      initialState,
      lessonAccessForm("?", "ABC234"),
    )).resolves.toMatchObject({
      status: "error",
      message: "Bạn không thuộc lớp học phần này",
    });

    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
