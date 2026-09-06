"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/features/auth/teacher-session";
import { createClient } from "@/lib/supabase/server";

export async function setChapterPreviewAction(chapterId: string, enabled: boolean) {
  const input = z.object({ chapterId: z.string().uuid(), enabled: z.boolean() }).safeParse({ chapterId, enabled });
  if (!input.success) return { status: "error" as const, message: "Chương không hợp lệ." };
  await requireTeacher();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_chapter_preview", {
    p_chapter_id: input.data.chapterId,
    p_enabled: input.data.enabled,
  });
  if (error || data !== enabled) {
    return { status: "error" as const, message: "Không thể thay đổi xem trước. Chương cần có Lesson và chưa có Session." };
  }
  revalidatePath("/teacher/subjects/[subjectId]/sections/[courseSectionId]", "page");
  revalidatePath("/learn/subjects/[subjectId]/sections/[courseSectionId]", "page");
  revalidatePath("/learn/subjects/[subjectId]/sections/[courseSectionId]/chapters/[chapterId]", "page");
  return { status: "success" as const };
}
