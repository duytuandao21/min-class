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
  createCourseSectionAction,
  createSubjectAction,
  deleteSubjectAction,
  type ManagementActionState,
  updateChapterAction,
  updateSubjectAction,
} from "./actions";

const teacherId = "aa000000-0000-0000-0000-000000000001";
const subjectId = "aa100000-0000-4000-8000-000000000001";
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
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher/subjects");
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
    const query = createMutationQuery({ data: null, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await createCourseSectionAction(subjectId, initialManagementActionState, courseSectionForm());

    expect(query.insert).toHaveBeenCalledWith({
      subject_id: subjectId,
      section_code: "24110NETW42001",
      display_name: "Ca sáng",
    });
    expect(result.status).toBe("success");
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

  it("updates only the requested Chapter in its Subject", async () => {
    const query = createMutationQuery({ data: { id: chapterId }, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await updateChapterAction(subjectId, chapterId, initialManagementActionState, chapterForm("Chương 2: TCP"));

    expect(query.update).toHaveBeenCalledWith({ name: "Chương 2: TCP" });
    expect(query.eq).toHaveBeenCalledWith("id", chapterId);
    expect(query.eq).toHaveBeenCalledWith("subject_id", subjectId);
    expect(result.status).toBe("success");
  });

  it("rejects an invalid section code before accessing Supabase", async () => {
    const result = await createCourseSectionAction(subjectId, initialManagementActionState, courseSectionForm("INVALID CODE"));

    expect(result.status).toBe("error");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
