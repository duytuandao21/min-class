import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireTeacher: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createChapterAction,
  createCourseSectionChapterAction,
  createCourseSectionAction,
  createSubjectAction,
  deleteCourseSectionChapterAction,
  deleteCourseSectionAction,
  deleteSubjectAction,
  type ManagementActionState,
  updateChapterAction,
  updateCourseSectionChapterAction,
  updateSubjectAction,
} from "./actions";

const teacherId = "aa000000-0000-0000-0000-000000000001";
const subjectId = "aa100000-0000-4000-8000-000000000001";
const courseSectionId = "aa200000-0000-4000-8000-000000000001";
const chapterId = "aa150000-0000-4000-8000-000000000001";
const redirectSignal = new Error("NEXT_REDIRECT");
const initialManagementActionState: ManagementActionState = { status: "idle" };

function createMutationQuery(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const query = {
    data: result.data,
    error: result.error,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.insert.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

function subjectForm(name = "Mạng máy tính", code = "NETW420") {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("code", code);
  return formData;
}

function courseSectionForm(sectionCode = "24110NETW42001", displayName = "Ca sáng") {
  const formData = new FormData();
  formData.set("sectionCode", sectionCode);
  formData.set("displayName", displayName);
  return formData;
}

function chapterForm(name = "Chương 1: Giới thiệu") {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

describe("Subject management actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacher.mockResolvedValue({ id: teacherId, email: "thaybao@minclass.local" });
    mocks.redirect.mockImplementation(() => { throw redirectSignal; });
  });

  it("creates a Subject owned by the authenticated Teacher", async () => {
    const query = createMutationQuery({ data: { id: subjectId }, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    await expect(createSubjectAction(initialManagementActionState, subjectForm())).rejects.toBe(redirectSignal);

    expect(query.insert).toHaveBeenCalledWith({ teacher_id: teacherId, name: "Mạng máy tính", code: "NETW420" });
    expect(mocks.redirect).toHaveBeenCalledWith(`/teacher/subjects/${subjectId}?lessonPlan=setup`);
  });

  it("updates only the requested owned Subject", async () => {
    const query = createMutationQuery({ data: { id: subjectId }, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await updateSubjectAction(subjectId, initialManagementActionState, subjectForm("Mạng nâng cao", "netw421"));

    expect(query.update).toHaveBeenCalledWith({ name: "Mạng nâng cao", code: "NETW421" });
    expect(query.eq).toHaveBeenCalledWith("teacher_id", teacherId);
    expect(result.status).toBe("success");
  });

  it("deletes only the requested owned Subject", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: subjectId, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(deleteSubjectAction(subjectId)).rejects.toBe(redirectSignal);

    expect(rpc).toHaveBeenCalledWith("delete_subject", { p_subject_id: subjectId });
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher/subjects");
  });

  it("does not redirect when the Subject delete RPC is rejected", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } }),
    });

    await expect(deleteSubjectAction(subjectId)).rejects.toThrow(
      "Không thể xóa môn học hoặc bạn không có quyền xóa.",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("creates a valid Course Section", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "course-section-id", error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await createCourseSectionAction(subjectId, initialManagementActionState, courseSectionForm());

    expect(rpc).toHaveBeenCalledWith("create_course_section_from_template", {
      p_subject_id: subjectId,
      p_section_code: "24110NETW42001",
      p_display_name: "Ca sáng",
    });
    expect(result.status).toBe("success");
  });

  it("requires a template Lesson before creating a Course Section", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23514" } }),
    });
    const result = await createCourseSectionAction(subjectId, initialManagementActionState, courseSectionForm());
    expect(result).toEqual(expect.objectContaining({ status: "error" }));
    expect(result.message).toContain("Lesson mẫu");
  });

  it("deletes a Course Section through the owner-checked cascade RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: courseSectionId, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    await deleteCourseSectionAction(subjectId, courseSectionId);
    expect(rpc).toHaveBeenCalledWith("delete_course_section", {
      p_subject_id: subjectId,
      p_course_section_id: courseSectionId,
    });
  });

  it("creates a Chapter in the requested Subject", async () => {
    const query = createMutationQuery({ data: null, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await createChapterAction(subjectId, initialManagementActionState, chapterForm());

    expect(query.insert).toHaveBeenCalledWith({
      subject_id: subjectId,
      name: "Chương 1: Giới thiệu",
    });
    expect(result.status).toBe("success");
  });

  it("creates an independent Chapter in the requested Course Section", async () => {
    const query = createMutationQuery({ data: { id: courseSectionId }, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await createCourseSectionChapterAction(
      subjectId,
      courseSectionId,
      initialManagementActionState,
      chapterForm("Chương 6: Cây"),
    );

    expect(query.eq).toHaveBeenCalledWith("id", courseSectionId);
    expect(query.eq).toHaveBeenCalledWith("subject_id", subjectId);
    expect(query.insert).toHaveBeenCalledWith({
      course_section_id: courseSectionId,
      name: "Chương 6: Cây",
    });
    expect(result.status).toBe("success");
  });

  it("does not create a Chapter in an unavailable Course Section", async () => {
    const query = createMutationQuery({ data: null, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await createCourseSectionChapterAction(
      subjectId,
      courseSectionId,
      initialManagementActionState,
      chapterForm(),
    );

    expect(query.insert).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it("deletes an empty owned Course Section Chapter through the guarded RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: chapterId, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await deleteCourseSectionChapterAction(subjectId, courseSectionId, chapterId);

    expect(rpc).toHaveBeenCalledWith("delete_course_section_chapter", {
      p_subject_id: subjectId,
      p_course_section_id: courseSectionId,
      p_chapter_id: chapterId,
    });
    expect(result.status).toBe("success");
  });

  it("reports a rejected Course Section Chapter cascade delete", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } }),
    });

    const result = await deleteCourseSectionChapterAction(subjectId, courseSectionId, chapterId);

    expect(result).toEqual(expect.objectContaining({ status: "error" }));
    expect(result.message).toContain("quyền");
  });

  it("updates only the requested Chapter in its Subject", async () => {
    const query = createMutationQuery({ data: { id: chapterId }, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await updateChapterAction(subjectId, chapterId, initialManagementActionState, chapterForm("Chương 2: TCP"));

    expect(query.update).toHaveBeenCalledWith({ name: "Chương 2: TCP" });
    expect(query.eq).toHaveBeenCalledWith("id", chapterId);
    expect(query.eq).toHaveBeenCalledWith("subject_id", subjectId);
    expect(result.status).toBe("success");
  });

  it("renames only the requested Chapter in its Course Section", async () => {
    const query = createMutationQuery({ data: { id: chapterId }, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await updateCourseSectionChapterAction(
      subjectId,
      courseSectionId,
      chapterId,
      initialManagementActionState,
      chapterForm("Chương 2: TCP"),
    );

    expect(query.update).toHaveBeenCalledWith({ name: "Chương 2: TCP" });
    expect(query.eq).toHaveBeenCalledWith("id", chapterId);
    expect(query.eq).toHaveBeenCalledWith("course_section_id", courseSectionId);
    expect(result.status).toBe("success");
  });

  it("rejects an invalid section code before accessing Supabase", async () => {
    const result = await createCourseSectionAction(subjectId, initialManagementActionState, courseSectionForm("INVALID CODE"));

    expect(result.status).toBe("error");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
