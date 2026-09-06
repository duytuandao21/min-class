"use server";

import { chapterPreviewInputSchema, chapterPreviewSchema, type ChapterPreview } from "./chapter-preview";
import { sortLessonsByTitle } from "@/features/lessons/order";
import { createClient } from "@/lib/supabase/server";

export type ChapterPreviewResult = { status: "success"; preview: ChapterPreview } | { status: "error"; message: string };

export async function readChapterPreviewAction(chapterId: string, mssv: string): Promise<ChapterPreviewResult> {
  const input = chapterPreviewInputSchema.safeParse({ chapterId, mssv });
  const denied: ChapterPreviewResult = { status: "error", message: "Không thể xem trước chương. Kiểm tra MSSV hoặc quay lại lớp học phần để cập nhật trạng thái." };
  const outsideRoster: ChapterPreviewResult = { status: "error", message: "Bạn không thuộc lớp học phần này" };
  if (!input.success) {
    return input.error.issues.some((issue) => issue.path[0] === "mssv")
      ? outsideRoster
      : denied;
  }
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user?.is_anonymous) return denied;
    const { data, error } = await supabase.rpc("get_student_chapter_preview", {
      p_chapter_id: input.data.chapterId,
      p_mssv: input.data.mssv,
    });
    if (error) return error.code === "P0003" ? outsideRoster : denied;
    const preview = chapterPreviewSchema.safeParse(data);
    if (!preview.success || preview.data.chapterId !== input.data.chapterId) return denied;
    return { status: "success", preview: { ...preview.data, lessons: sortLessonsByTitle(preview.data.lessons) } };
  } catch {
    return denied;
  }
}
