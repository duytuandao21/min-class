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
  join_code: z.string(),
  session_status: z.literal("ACTIVE"),
  started_at: z.string(),
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
