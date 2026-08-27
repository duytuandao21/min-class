import "server-only";

import { requireTeacher } from "@/features/auth/teacher-session";
import {
  courseSectionExportDataSchema,
  type CourseSectionExportData,
} from "@/features/subjects/course-section-export";
import { courseSectionIdSchema, subjectIdSchema } from "@/features/subjects/schemas";
import { createClient } from "@/lib/supabase/server";

export async function getCourseSectionExportData(
  rawSubjectId: string,
  rawCourseSectionId: string,
): Promise<CourseSectionExportData | null> {
  await requireTeacher();

  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  if (!subjectId.success || !courseSectionId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_teacher_course_section_export", {
    p_subject_id: subjectId.data,
    p_course_section_id: courseSectionId.data,
  });
  if (error) throw new Error("Không thể tổng hợp dữ liệu lớp học phần.");
  if (data === null) return null;

  const parsed = courseSectionExportDataSchema.safeParse(data);
  if (!parsed.success) throw new Error("Dữ liệu xuất lớp học phần không hợp lệ.");
  return parsed.data;
}
