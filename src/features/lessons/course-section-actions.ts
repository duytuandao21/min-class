"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireTeacher } from "@/features/auth/teacher-session";
import {
  MAX_MARKDOWN_BYTES,
  MarkdownValidationError,
  parseLessonMarkdown,
} from "@/features/lessons/markdown/parser";
import type { NormalizedLesson } from "@/features/lessons/markdown/schema";
import { chapterIdSchema, courseSectionIdSchema, subjectIdSchema } from "@/features/subjects/schemas";
import { createClient } from "@/lib/supabase/server";

const lessonTitleSchema = z.string().trim().min(1, "Nhập tên Lesson.").max(200, "Tên Lesson tối đa 200 ký tự.");
const lessonFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "File Markdown không được để trống.")
  .refine((file) => file.size <= MAX_MARKDOWN_BYTES, "File Markdown không được vượt quá 1 MB.")
  .refine((file) => file.name.toLowerCase().endsWith(".md"), "Chỉ chấp nhận file .md.");

const saveInputSchema = z.object({
  lessonTitle: lessonTitleSchema,
  markdownSource: z.string().min(1).max(MAX_MARKDOWN_BYTES),
});

export type CourseSectionLessonPreviewResult =
  | {
      ok: true;
      lessonTitle: string;
      fileName: string;
      markdownSource: string;
      lesson: NormalizedLesson;
    }
  | { ok: false; errors: string[] };

export type SaveCourseSectionLessonResult =
  | { ok: true; lesson: { id: string; title: string; createdAt: string } }
  | { ok: false; errors: string[] };

function zodMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message);
}

async function ownsLessonPlacement(subjectId: string, courseSectionId: string, chapterId: string): Promise<boolean> {
  const supabase = await createClient();
  const [courseSectionResult, chapterResult] = await Promise.all([
    supabase
      .from("course_sections")
      .select("id")
      .eq("id", courseSectionId)
      .eq("subject_id", subjectId)
      .maybeSingle(),
    supabase
      .from("chapters")
      .select("id")
      .eq("id", chapterId)
      .eq("subject_id", subjectId)
      .maybeSingle(),
  ]);
  return !courseSectionResult.error
    && !chapterResult.error
    && Boolean(courseSectionResult.data)
    && Boolean(chapterResult.data);
}

export async function previewCourseSectionLessonAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
  formData: FormData,
): Promise<CourseSectionLessonPreviewResult> {
  await requireTeacher();

  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = z.object({ lessonTitle: lessonTitleSchema, lessonFile: lessonFileSchema }).safeParse({
    lessonTitle: formData.get("lessonTitle"),
    lessonFile: formData.get("lessonFile"),
  });
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) return { ok: false, errors: ["Course Section hoặc chương không hợp lệ."] };
  if (!input.success) return { ok: false, errors: zodMessages(input.error) };
  if (!await ownsLessonPlacement(subjectId.data, courseSectionId.data, chapterId.data)) {
    return { ok: false, errors: ["Không tìm thấy Course Section, chương hoặc bạn không có quyền truy cập."] };
  }

  try {
    const markdownSource = await input.data.lessonFile.text();
    const parsedLesson = parseLessonMarkdown(markdownSource);
    return {
      ok: true,
      lessonTitle: input.data.lessonTitle,
      fileName: input.data.lessonFile.name,
      markdownSource,
      lesson: { ...parsedLesson, title: input.data.lessonTitle },
    };
  } catch (error) {
    if (error instanceof MarkdownValidationError) return { ok: false, errors: error.issues };
    return { ok: false, errors: ["Không thể đọc file Markdown."] };
  }
}

export async function saveCourseSectionLessonAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
  rawInput: unknown,
): Promise<SaveCourseSectionLessonResult> {
  await requireTeacher();

  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = saveInputSchema.safeParse(rawInput);
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) return { ok: false, errors: ["Course Section hoặc chương không hợp lệ."] };
  if (!input.success) return { ok: false, errors: zodMessages(input.error) };

  let lesson: NormalizedLesson;
  try {
    lesson = { ...parseLessonMarkdown(input.data.markdownSource), title: input.data.lessonTitle };
  } catch (error) {
    if (error instanceof MarkdownValidationError) return { ok: false, errors: error.issues };
    return { ok: false, errors: ["Lesson không hợp lệ."] };
  }

  if (!await ownsLessonPlacement(subjectId.data, courseSectionId.data, chapterId.data)) {
    return { ok: false, errors: ["Không tìm thấy Course Section, chương hoặc bạn không có quyền truy cập."] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_course_section_lesson", {
    p_course_section_id: courseSectionId.data,
    p_chapter_id: chapterId.data,
    p_lesson_title: input.data.lessonTitle,
    p_markdown_source: input.data.markdownSource,
    p_lesson: lesson,
  });
  if (error) return { ok: false, errors: ["Không thể lưu Lesson. Hãy thử lại."] };

  const persisted = z.array(z.object({
    lesson_id: z.string().uuid(),
    lesson_title: z.string(),
    lesson_created_at: z.string(),
  })).length(1).safeParse(data);
  if (!persisted.success) return { ok: false, errors: ["Lesson đã lưu nhưng phản hồi không hợp lệ."] };

  revalidatePath(`/teacher/subjects/${subjectId.data}/sections/${courseSectionId.data}`);
  return {
    ok: true,
    lesson: {
      id: persisted.data[0].lesson_id,
      title: persisted.data[0].lesson_title,
      createdAt: persisted.data[0].lesson_created_at,
    },
  };
}
