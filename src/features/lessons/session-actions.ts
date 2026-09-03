"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireTeacher } from "@/features/auth/teacher-session";
import { createClient } from "@/lib/supabase/server";

export type StartLessonSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; message: string };

const startedSessionSchema = z.object({
  session_id: z.string().uuid(),
  session_status: z.literal("ACTIVE"),
  started_at: z.string(),
});

const chapterSessionInputSchema = z.object({
  courseSectionId: z.string().uuid(),
  chapterId: z.string().uuid(),
});

export async function startLessonSessionAction(input: unknown): Promise<StartLessonSessionResult> {
  await requireTeacher();

  const lessonId = z.string().uuid().safeParse(input);
  if (!lessonId.success) return { ok: false, message: "Lesson không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_lesson_session", {
    p_lesson_id: lessonId.data,
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505"
        ? "Lớp học phần này đang có một Lesson LIVE."
        : "Không thể bắt đầu Lesson.",
    };
  }

  const result = startedSessionSchema.safeParse(Array.isArray(data) ? data[0] : null);
  if (!result.success) return { ok: false, message: "Lesson Session đã tạo nhưng phản hồi không hợp lệ." };

  revalidatePath("/teacher/subjects");
  return { ok: true, sessionId: result.data.session_id };
}

export async function startChapterSessionAction(input: unknown): Promise<StartLessonSessionResult> {
  await requireTeacher();
  const parsed = chapterSessionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Chương không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_chapter_session", {
    p_course_section_id: parsed.data.courseSectionId,
    p_chapter_id: parsed.data.chapterId,
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "23505"
        ? "Lớp học phần này đang có một buổi học LIVE."
        : error.code === "P0001"
          ? "Chương cần có ít nhất một Lesson hợp lệ."
          : "Không thể bắt đầu buổi học.",
    };
  }
  const result = startedSessionSchema.safeParse(Array.isArray(data) ? data[0] : null);
  if (!result.success) return { ok: false, message: "Session đã tạo nhưng phản hồi không hợp lệ." };
  revalidatePath("/teacher/subjects");
  return { ok: true, sessionId: result.data.session_id };
}
