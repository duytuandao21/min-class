"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTeacher } from "@/features/auth/teacher-session";
import {
  chapterIdSchema,
  chapterInputSchema,
  courseSectionIdSchema,
  courseSectionInputSchema,
  subjectIdSchema,
  subjectInputSchema,
} from "@/features/subjects/schemas";
import { createClient } from "@/lib/supabase/server";

export type ManagementActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function errorState(message: string, fieldErrors?: Record<string, string[]>): ManagementActionState {
  return { status: "error", message, fieldErrors };
}

function databaseErrorMessage(code: string | undefined, entity: string): string {
  if (code === "23505") return `${entity} đã tồn tại.`;
  if (code === "23514") return `${entity} không hợp lệ.`;
  return `Không thể lưu ${entity.toLowerCase()}. Hãy thử lại.`;
}

export async function createSubjectAction(
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const teacher = await requireTeacher();
  const input = subjectInputSchema.safeParse({ name: formData.get("name"), code: formData.get("code") });
  if (!input.success) return errorState("Kiểm tra lại thông tin môn học.", input.error.flatten().fieldErrors);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ teacher_id: teacher.id, name: input.data.name, code: input.data.code ?? null })
    .select("id")
    .single();

  if (error || !data) return errorState(databaseErrorMessage(error?.code, "Môn học"));
  revalidatePath("/teacher/subjects");
  redirect(`/teacher/subjects/${data.id}?lessonPlan=setup`);
}

export async function updateSubjectAction(
  rawSubjectId: string,
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const input = subjectInputSchema.safeParse({ name: formData.get("name"), code: formData.get("code") });
  if (!subjectId.success) return errorState("Môn học không hợp lệ.");
  if (!input.success) return errorState("Kiểm tra lại thông tin môn học.", input.error.flatten().fieldErrors);

  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .update({ name: input.data.name, code: input.data.code ?? null })
    .eq("id", subjectId.data)
    .eq("teacher_id", teacher.id)
    .select("id")
    .maybeSingle();

  if (error) return errorState(databaseErrorMessage(error.code, "Môn học"));
  if (!data) return errorState("Không tìm thấy môn học hoặc bạn không có quyền sửa.");
  revalidatePath("/teacher/subjects");
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
  return { status: "success", message: "Đã cập nhật môn học." };
}

export async function deleteSubjectAction(rawSubjectId: string): Promise<void> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  if (!subjectId.success) throw new Error("Môn học không hợp lệ.");

  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_subject", {
    p_subject_id: subjectId.data,
  });

  if (error || data !== subjectId.data) {
    throw new Error("Không thể xóa môn học hoặc bạn không có quyền xóa.");
  }
  revalidatePath("/teacher/subjects");
  redirect("/teacher/subjects");
}

export async function createChapterAction(
  rawSubjectId: string,
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const input = chapterInputSchema.safeParse({ name: formData.get("name") });
  if (!subjectId.success) return errorState("Môn học không hợp lệ.");
  if (!input.success) return errorState("Kiểm tra lại tên chương.", input.error.flatten().fieldErrors);

  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("chapters").insert({
    subject_id: subjectId.data,
    name: input.data.name,
  });

  if (error) return errorState(databaseErrorMessage(error.code, "Chương"));
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
  return { status: "success", message: "Đã thêm chương." };
}

export async function createCourseSectionChapterAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const input = chapterInputSchema.safeParse({ name: formData.get("name") });
  if (!subjectId.success || !courseSectionId.success) return errorState("Lớp học phần không hợp lệ.");
  if (!input.success) return errorState("Kiểm tra lại tên chương.", input.error.flatten().fieldErrors);

  await requireTeacher();
  const supabase = await createClient();
  const { data: courseSection, error: courseSectionError } = await supabase
    .from("course_sections")
    .select("id")
    .eq("id", courseSectionId.data)
    .eq("subject_id", subjectId.data)
    .maybeSingle();
  if (courseSectionError || !courseSection) {
    return errorState("Không tìm thấy lớp học phần hoặc bạn không có quyền thêm chương.");
  }

  const { error } = await supabase.from("chapters").insert({
    course_section_id: courseSectionId.data,
    name: input.data.name,
  });
  if (error) return errorState(databaseErrorMessage(error.code, "Chương"));

  revalidatePath(`/teacher/subjects/${subjectId.data}/sections/${courseSectionId.data}`);
  return { status: "success", message: "Đã thêm chương cho lớp học phần." };
}

export async function updateChapterAction(
  rawSubjectId: string,
  rawChapterId: string,
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = chapterInputSchema.safeParse({ name: formData.get("name") });
  if (!subjectId.success || !chapterId.success) return errorState("Chương không hợp lệ.");
  if (!input.success) return errorState("Kiểm tra lại tên chương.", input.error.flatten().fieldErrors);

  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .update({ name: input.data.name })
    .eq("id", chapterId.data)
    .eq("subject_id", subjectId.data)
    .select("id")
    .maybeSingle();

  if (error) return errorState(databaseErrorMessage(error.code, "Chương"));
  if (!data) return errorState("Không tìm thấy chương hoặc bạn không có quyền sửa.");
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
  return { status: "success", message: "Đã cập nhật chương." };
}

export async function updateCourseSectionChapterAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = chapterInputSchema.safeParse({ name: formData.get("name") });
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) {
    return errorState("Chương không hợp lệ.");
  }
  if (!input.success) return errorState("Kiểm tra lại tên chương.", input.error.flatten().fieldErrors);

  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .update({ name: input.data.name })
    .eq("id", chapterId.data)
    .eq("course_section_id", courseSectionId.data)
    .select("id")
    .maybeSingle();

  if (error) return errorState(databaseErrorMessage(error.code, "Chương"));
  if (!data) return errorState("Không tìm thấy chương hoặc bạn không có quyền sửa.");
  revalidatePath(`/teacher/subjects/${subjectId.data}/sections/${courseSectionId.data}`);
  return { status: "success", message: "Đã đổi tên chương." };
}

export async function createCourseSectionAction(
  rawSubjectId: string,
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const input = courseSectionInputSchema.safeParse({
    sectionCode: formData.get("sectionCode"),
    displayName: formData.get("displayName"),
  });
  if (!subjectId.success) return errorState("Môn học không hợp lệ.");
  if (!input.success) return errorState("Kiểm tra lại thông tin lớp học phần.", input.error.flatten().fieldErrors);

  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_course_section_from_template", {
    p_subject_id: subjectId.data,
    p_section_code: input.data.sectionCode,
    p_display_name: input.data.displayName ?? "",
  });

  if (error) {
    if (error.code === "23514") return errorState("Hãy tạo ít nhất một Lesson mẫu trước khi thêm lớp học phần.");
    return errorState(databaseErrorMessage(error.code, "Lớp học phần"));
  }
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
  return { status: "success", message: "Đã thêm lớp học phần." };
}

export async function deleteChapterAction(rawSubjectId: string, rawChapterId: string): Promise<void> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  if (!subjectId.success || !chapterId.success) throw new Error("Chương không hợp lệ.");

  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_subject_chapter", {
    p_subject_id: subjectId.data,
    p_chapter_id: chapterId.data,
  });
  if (error || data !== chapterId.data) {
    throw new Error("Không thể xóa chương. Hãy xóa các Lesson trong chương trước.");
  }
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
}

export async function deleteCourseSectionChapterAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) {
    return errorState("Chương không hợp lệ.");
  }

  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_course_section_chapter", {
    p_subject_id: subjectId.data,
    p_course_section_id: courseSectionId.data,
    p_chapter_id: chapterId.data,
  });
  if (error || data !== chapterId.data) {
    return errorState("Không thể xóa chương hoặc bạn không có quyền xóa.");
  }

  revalidatePath(`/teacher/subjects/${subjectId.data}/sections/${courseSectionId.data}`);
  return { status: "success", message: "Đã xóa chương." };
}

export async function updateCourseSectionAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const input = courseSectionInputSchema.safeParse({
    sectionCode: formData.get("sectionCode"),
    displayName: formData.get("displayName"),
  });
  if (!subjectId.success || !courseSectionId.success) return errorState("Lớp học phần không hợp lệ.");
  if (!input.success) return errorState("Kiểm tra lại thông tin lớp học phần.", input.error.flatten().fieldErrors);

  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_sections")
    .update({ section_code: input.data.sectionCode, display_name: input.data.displayName ?? null })
    .eq("id", courseSectionId.data)
    .eq("subject_id", subjectId.data)
    .select("id")
    .maybeSingle();

  if (error) return errorState(databaseErrorMessage(error.code, "Lớp học phần"));
  if (!data) return errorState("Không tìm thấy lớp học phần hoặc bạn không có quyền sửa.");
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
  return { status: "success", message: "Đã cập nhật lớp học phần." };
}

export async function deleteCourseSectionAction(rawSubjectId: string, rawCourseSectionId: string): Promise<void> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  if (!subjectId.success || !courseSectionId.success) throw new Error("Lớp học phần không hợp lệ.");

  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_course_section", {
    p_subject_id: subjectId.data,
    p_course_section_id: courseSectionId.data,
  });

  if (error || !data) throw new Error("Không thể xóa lớp học phần hoặc bạn không có quyền xóa.");
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
}
