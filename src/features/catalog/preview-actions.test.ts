import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicChapterStatus } from "./chapter-preview";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet, set: mocks.cookieSet })),
}));
import {
  forgetCourseSectionStudentAction,
  getRememberedCourseSectionStudent,
  readChapterPreviewAction,
  verifyCourseSectionStudentAction,
} from "./preview-actions";

const chapterId = "aa300000-0000-4000-8000-000000000001";
const courseSectionId = "aa200000-0000-4000-8000-000000000001";
const lessonId = "aa400000-0000-4000-8000-000000000001";
const content = { chapterId, title: "Chương 1", lessons: [
  { id: lessonId, title: "Bài 10", sections: [] },
  { id: "aa400000-0000-4000-8000-000000000002", title: "Bài 2", sections: [] },
] };

function setup(anonymous = true) {
  const rpc = vi.fn().mockResolvedValue({ data: content, error: null });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { is_anonymous: anonymous } }, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser }, rpc });
  return { rpc, getUser };
}

describe("Student chapter preview", () => {
  beforeEach(() => vi.clearAllMocks());
  it("normalizes MSSV, verifies auth, calls the guarded RPC and sorts lessons naturally", async () => {
    const { rpc, getUser } = setup();
    const result = await readChapterPreviewAction(chapterId, " sv001 ");
    expect(getUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_student_chapter_preview", { p_chapter_id: chapterId, p_mssv: "SV001" });
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.preview.lessons.map((lesson) => lesson.title)).toEqual(["Bài 2", "Bài 10"]);
  });
  it.each([[chapterId, "!"], [chapterId, ""]])("rejects an invalid MSSV before database access", async (id, mssv) => {
    expect(await readChapterPreviewAction(id, mssv)).toEqual({
      status: "error",
      message: "Bạn không thuộc lớp học phần này",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects an invalid Chapter before database access", async () => {
    expect((await readChapterPreviewAction("bad-id", "SV001")).status).toBe("error");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("blocks Teacher identities", async () => {
    const { rpc } = setup(false);
    expect((await readChapterPreviewAction(chapterId, "SV001")).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("blocks missing or expired authentication", async () => {
    const { rpc, getUser } = setup();
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    expect((await readChapterPreviewAction(chapterId, "SV001")).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses a safe error for closed and unavailable chapters", async () => {
    const { rpc } = setup();
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private detail" } });
    const result = await readChapterPreviewAction(chapterId, "SV999");
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("private detail");
  });
  it("shows the same roster warning as LIVE for a non-roster MSSV", async () => {
    const { rpc } = setup();
    rpc.mockResolvedValue({ data: null, error: { code: "P0003", message: "private detail" } });
    expect(await readChapterPreviewAction(chapterId, "SV999")).toEqual({
      status: "error",
      message: "Bạn không thuộc lớp học phần này",
    });
  });
  it("fails closed on a mismatched chapter or malformed payload", async () => {
    const { rpc } = setup();
    rpc.mockResolvedValueOnce({ data: { ...content, chapterId: lessonId }, error: null });
    expect((await readChapterPreviewAction(chapterId, "SV001")).status).toBe("error");
    rpc.mockResolvedValueOnce({ data: { title: "bad" }, error: null });
    expect((await readChapterPreviewAction(chapterId, "SV001")).status).toBe("error");
  });
  it("returns a safe error on connection failure", async () => {
    mocks.createClient.mockRejectedValue(new Error("secret connection details"));
    expect((await readChapterPreviewAction(chapterId, "SV001")).status).toBe("error");
  });
  it("prioritizes LIVE and ENDED over preview and leaves empty chapters unavailable", () => {
    expect(getPublicChapterStatus([{ lesson_status: "LIVE" }], true)).toBe("LIVE");
    expect(getPublicChapterStatus([{ lesson_status: "ENDED" }], true)).toBe("ENDED");
    expect(getPublicChapterStatus([{ lesson_status: "UPCOMING" }], true)).toBe("PREVIEW");
    expect(getPublicChapterStatus([{ lesson_status: "UPCOMING" }], false)).toBe("UPCOMING");
    expect(getPublicChapterStatus([], true)).toBe("UPCOMING");
  });
});

describe("Course Section Student access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes MSSV and verifies roster membership without returning roster data", async () => {
    const { rpc } = setup();
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(verifyCourseSectionStudentAction(courseSectionId, " sv001 ")).resolves.toEqual({
      status: "success",
      mssv: "SV001",
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("verify_course_section_student", {
      p_course_section_id: courseSectionId,
      p_mssv: "SV001",
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      `minclass-course-section-student-${courseSectionId}`,
      "SV001",
      expect.objectContaining({ httpOnly: true, path: "/learn/subjects", sameSite: "lax" }),
    );
  });

  it("denies a Student outside the Course Section roster", async () => {
    const { rpc } = setup();
    rpc.mockResolvedValue({ data: null, error: { code: "P0003" } });

    await expect(verifyCourseSectionStudentAction(courseSectionId, "SV999")).resolves.toEqual({
      status: "error",
      message: "Bạn không thuộc lớp học phần này",
    });
  });

  it("rejects invalid input and Teacher identities", async () => {
    await expect(verifyCourseSectionStudentAction("bad-id", "SV001")).resolves.toMatchObject({ status: "error" });
    expect(mocks.createClient).not.toHaveBeenCalled();

    const { rpc } = setup(false);
    await expect(verifyCourseSectionStudentAction(courseSectionId, "SV001")).resolves.toMatchObject({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("restores and clears a valid Course Section access cookie", async () => {
    mocks.cookieGet.mockReturnValue({ value: " sv001 " });

    await expect(getRememberedCourseSectionStudent(courseSectionId)).resolves.toBe("SV001");
    expect(mocks.cookieGet).toHaveBeenCalledWith(`minclass-course-section-student-${courseSectionId}`);

    await forgetCourseSectionStudentAction(courseSectionId);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      `minclass-course-section-student-${courseSectionId}`,
      "",
      expect.objectContaining({ maxAge: 0, path: "/learn/subjects" }),
    );
  });

  it("ignores malformed Course Section access cookies", async () => {
    mocks.cookieGet.mockReturnValue({ value: "!" });
    await expect(getRememberedCourseSectionStudent(courseSectionId)).resolves.toBeNull();
    await expect(getRememberedCourseSectionStudent("bad-id")).resolves.toBeNull();
  });
});
