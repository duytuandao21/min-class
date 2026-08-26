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
  redirect("/teacher/subjects");
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

  const teacher = await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId.data)
    .eq("teacher_id", teacher.id)
    .select("id")
    .maybeSingle();

  if (error || !data) throw new Error("Không thể xóa môn học hoặc bạn không có quyền xóa.");
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
  const { error } = await supabase.from("course_sections").insert({
    subject_id: subjectId.data,
    section_code: input.data.sectionCode,
    display_name: input.data.displayName ?? null,
  });

  if (error) return errorState(databaseErrorMessage(error.code, "Lớp học phần"));
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
  return { status: "success", message: "Đã thêm lớp học phần." };
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
  const { data, error } = await supabase
    .from("course_sections")
    .delete()
    .eq("id", courseSectionId.data)
    .eq("subject_id", subjectId.data)
    .select("id")
    .maybeSingle();

  if (error || !data) throw new Error("Không thể xóa lớp học phần hoặc bạn không có quyền xóa.");
  revalidatePath(`/teacher/subjects/${subjectId.data}`);
}
