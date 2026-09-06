import { z } from "zod";

import { lessonAccessInputSchema, type PublicLessonStatus } from "./schemas";

export const chapterPreviewInputSchema = z.object({
  chapterId: z.string().uuid(),
  mssv: lessonAccessInputSchema.shape.mssv,
});

export const chapterPreviewSchema = z.object({
  chapterId: z.string().uuid(),
  title: z.string().min(1),
  lessons: z.array(z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    sections: z.array(z.object({
      id: z.string().uuid(),
      title: z.string().min(1),
      position: z.number().int().nonnegative(),
      type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]),
      contentMd: z.string(),
    })),
  })),
});
export type ChapterPreview = z.infer<typeof chapterPreviewSchema>;
export type PublicChapterStatus = PublicLessonStatus | "PREVIEW";

export function getPublicChapterStatus(
  lessons: { lesson_status: PublicLessonStatus }[],
  previewEnabled: boolean,
): PublicChapterStatus {
  if (lessons.some((lesson) => lesson.lesson_status === "LIVE")) return "LIVE";
  if (lessons.some((lesson) => lesson.lesson_status === "ENDED")) return "ENDED";
  return previewEnabled && lessons.length > 0 ? "PREVIEW" : "UPCOMING";
}
