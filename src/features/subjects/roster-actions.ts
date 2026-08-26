"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireTeacher } from "@/features/auth/teacher-session";
import { parseRosterText } from "@/features/subjects/roster-parser";
import { courseSectionIdSchema, subjectIdSchema } from "@/features/subjects/schemas";
import { createClient } from "@/lib/supabase/server";

const rosterSaveInputSchema = z.object({
  fileName: z.string().trim().min(1).max(255).refine(
    (value) => value.toLowerCase().endsWith(".txt"),
    "Chỉ chấp nhận file .txt.",
  ),
  rosterSource: z.string(),
});

export type RosterActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  savedCount?: number;
};

export async function saveCourseSectionRosterAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  _previousState: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const input = rosterSaveInputSchema.safeParse({
    fileName: formData.get("fileName"),
    rosterSource: formData.get("rosterSource"),
  });

  if (!subjectId.success || !courseSectionId.success) {
    return { status: "error", message: "Lớp học phần không hợp lệ." };
  }
  if (!input.success) {
    return { status: "error", message: input.error.issues[0]?.message ?? "File roster không hợp lệ." };
  }

  const preview = parseRosterText(input.data.rosterSource);
  if (!preview.canSave) {
    return {
      status: "error",
      message: `Không thể lưu: ${preview.duplicates.length} dòng trùng, ${preview.invalidLines.length} dòng không hợp lệ.`,
    };
  }

  await requireTeacher();
  const supabase = await createClient();
  const { data: courseSection, error: courseSectionError } = await supabase
    .from("course_sections")
    .select("id")
    .eq("id", courseSectionId.data)
    .eq("subject_id", subjectId.data)
    .maybeSingle();

  if (courseSectionError || !courseSection) {
    return { status: "error", message: "Không tìm thấy lớp học phần hoặc bạn không có quyền cập nhật." };
  }

  const { data, error } = await supabase.rpc("replace_course_section_roster", {
    p_course_section_id: courseSectionId.data,
    p_mssv: preview.students,
  });
  if (error) {
    return { status: "error", message: "Không thể lưu roster. Hãy kiểm tra quyền truy cập và thử lại." };
  }

  const savedCount = z.number().int().positive().safeParse(data);
  if (!savedCount.success) {
    return { status: "error", message: "Roster đã được lưu nhưng phản hồi không hợp lệ." };
  }

  revalidatePath(`/teacher/subjects/${subjectId.data}`);
  revalidatePath(`/teacher/subjects/${subjectId.data}/sections/${courseSectionId.data}`);
  return { status: "success", message: `Đã lưu ${savedCount.data} MSSV.`, savedCount: savedCount.data };
}
