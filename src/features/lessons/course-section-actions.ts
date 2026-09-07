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
import { chapterIdSchema, courseSectionIdSchema, lessonIdSchema, subjectIdSchema } from "@/features/subjects/schemas";
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

const MAX_BATCH_LESSONS = 20;
const batchSaveInputSchema = z.array(saveInputSchema).min(1).max(MAX_BATCH_LESSONS);

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

export type PreparedCourseSectionLesson = {
  fileName: string;
  lessonTitle: string;
  markdownSource: string;
  lesson: NormalizedLesson | null;
  errors: string[];
};

export type PrepareCourseSectionLessonsResult =
  | { ok: true; lessons: PreparedCourseSectionLesson[] }
  | { ok: false; errors: string[] };

export type SaveCourseSectionLessonsResult =
  | { ok: true; lessons: Array<{ id: string; title: string; createdAt: string }> }
  | { ok: false; errors: string[] };

export type SaveSubjectTemplateLessonsResult =
  | { ok: true; lessons: Array<{ id: string; appliedCount: number; skippedCount: number }> }
  | { ok: false; errors: string[] };

export type LessonMutationResult =
  | { ok: true; lessonId: string; appliedCount?: number; skippedCount?: number }
  | { ok: false; errors: string[] };

const syncedLessonResultSchema = z.object({
  lessonId: z.string().uuid(),
  appliedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

function zodMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message);
}

function stripChapterPrefix(title: string): string {
  const normalizedTitle = title.trim();
  const titleWithoutPrefix = normalizedTitle.replace(
    /^chương\s+(?:\d+(?:\.\d+)*|[ivxlcdm]+)\s*[-–—]\s*/iu,
    "",
  ).trim();
  return titleWithoutPrefix || normalizedTitle;
}

function normalizeLessonInput(rawInput: unknown): { ok: true; title: string; source: string; lesson: NormalizedLesson } | { ok: false; errors: string[] } {
  const input = saveInputSchema.safeParse(rawInput);
  if (!input.success) return { ok: false, errors: zodMessages(input.error) };
  try {
    return {
      ok: true,
      title: input.data.lessonTitle,
      source: input.data.markdownSource,
      lesson: { ...parseLessonMarkdown(input.data.markdownSource), title: input.data.lessonTitle },
    };
  } catch (error) {
    if (error instanceof MarkdownValidationError) return { ok: false, errors: error.issues };
    return { ok: false, errors: ["Lesson không hợp lệ."] };
  }
}

export async function previewLessonMarkdownAction(rawInput: unknown): Promise<CourseSectionLessonPreviewResult> {
  await requireTeacher();
  const normalized = normalizeLessonInput(rawInput);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    lessonTitle: normalized.title,
    fileName: "Nội dung đang chỉnh sửa",
    markdownSource: normalized.source,
    lesson: normalized.lesson,
  };
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
      .eq("course_section_id", courseSectionId)
      .maybeSingle(),
  ]);
  return !courseSectionResult.error
    && !chapterResult.error
    && Boolean(courseSectionResult.data)
    && Boolean(chapterResult.data);
}

async function ownsTemplateLessonPlacement(subjectId: string, chapterId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("id")
    .eq("id", chapterId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  return !error && Boolean(data);
}

async function prepareLessonFiles(formData: FormData): Promise<PrepareCourseSectionLessonsResult> {
  const files = formData.getAll("lessonFiles");
  if (files.length === 0) return { ok: false, errors: ["Hãy chọn ít nhất một file Markdown."] };
  if (files.length > MAX_BATCH_LESSONS) {
    return { ok: false, errors: [`Mỗi lần chỉ được thêm tối đa ${MAX_BATCH_LESSONS} Lesson.`] };
  }

  const lessons = await Promise.all(files.map(async (value): Promise<PreparedCourseSectionLesson> => {
    if (!(value instanceof File)) {
      return { fileName: "File không hợp lệ", lessonTitle: "", markdownSource: "", lesson: null, errors: ["File không hợp lệ."] };
    }
    const fallbackTitle = stripChapterPrefix(value.name.replace(/\.md$/i, "")).slice(0, 200);
    const fileValidation = lessonFileSchema.safeParse(value);
    if (!fileValidation.success) {
      return {
        fileName: value.name,
        lessonTitle: fallbackTitle,
        markdownSource: "",
        lesson: null,
        errors: zodMessages(fileValidation.error),
      };
    }
    try {
      const markdownSource = await value.text();
      const lesson = parseLessonMarkdown(markdownSource);
      const lessonTitle = stripChapterPrefix(lesson.title);
      return {
        fileName: value.name,
        lessonTitle,
        markdownSource,
        lesson: { ...lesson, title: lessonTitle },
        errors: [],
      };
    } catch (error) {
      return {
        fileName: value.name,
        lessonTitle: fallbackTitle,
        markdownSource: await value.text(),
        lesson: null,
        errors: error instanceof MarkdownValidationError ? error.issues : ["Không thể đọc file Markdown."],
      };
    }
  }));
  return { ok: true, lessons };
}

export async function prepareCourseSectionLessonsAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
  formData: FormData,
): Promise<PrepareCourseSectionLessonsResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) {
    return { ok: false, errors: ["Course Section hoặc chương không hợp lệ."] };
  }
  if (!await ownsLessonPlacement(subjectId.data, courseSectionId.data, chapterId.data)) {
    return { ok: false, errors: ["Không tìm thấy Course Section, chương hoặc bạn không có quyền truy cập."] };
  }

  return prepareLessonFiles(formData);
}

export async function prepareSubjectTemplateLessonsAction(
  rawSubjectId: string,
  rawChapterId: string,
  formData: FormData,
): Promise<PrepareCourseSectionLessonsResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  if (!subjectId.success || !chapterId.success) {
    return { ok: false, errors: ["Môn học hoặc chương không hợp lệ."] };
  }
  if (!await ownsTemplateLessonPlacement(subjectId.data, chapterId.data)) {
    return { ok: false, errors: ["Không tìm thấy môn học, chương hoặc bạn không có quyền truy cập."] };
  }
  return prepareLessonFiles(formData);
}

export async function saveCourseSectionLessonsBatchAction(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
  rawInput: unknown,
): Promise<SaveCourseSectionLessonsResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const courseSectionId = courseSectionIdSchema.safeParse(rawCourseSectionId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = batchSaveInputSchema.safeParse(rawInput);
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) {
    return { ok: false, errors: ["Course Section hoặc chương không hợp lệ."] };
  }
  if (!input.success) return { ok: false, errors: zodMessages(input.error) };

  const duplicateTitles = new Set<string>();
  const seenTitles = new Set<string>();
  const normalizedLessons: Array<{ lessonTitle: string; markdownSource: string; lesson: NormalizedLesson }> = [];
  for (const item of input.data) {
    const normalized = normalizeLessonInput(item);
    if (!normalized.ok) return normalized;
    const titleKey = normalized.title.toLocaleLowerCase("vi");
    if (seenTitles.has(titleKey)) duplicateTitles.add(normalized.title);
    seenTitles.add(titleKey);
    normalizedLessons.push({ lessonTitle: normalized.title, markdownSource: normalized.source, lesson: normalized.lesson });
  }
  if (duplicateTitles.size > 0) {
    return { ok: false, errors: [`Tên Lesson bị trùng trong danh sách: ${[...duplicateTitles].join(", ")}.`] };
  }
  if (!await ownsLessonPlacement(subjectId.data, courseSectionId.data, chapterId.data)) {
    return { ok: false, errors: ["Không tìm thấy Course Section, chương hoặc bạn không có quyền truy cập."] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_course_section_lessons_batch", {
    p_course_section_id: courseSectionId.data,
    p_chapter_id: chapterId.data,
    p_lessons: normalizedLessons,
  });
  const persisted = z.array(z.object({
    lessonId: z.string().uuid(),
    lessonTitle: z.string(),
    lessonCreatedAt: z.string(),
  })).length(normalizedLessons.length).safeParse(data);
  if (error || !persisted.success) {
    return { ok: false, errors: ["Không thể lưu danh sách Lesson. Không có Lesson nào được tạo."] };
  }
  revalidatePath(`/teacher/subjects/${subjectId.data}/sections/${courseSectionId.data}`);
  return {
    ok: true,
    lessons: persisted.data.map((lesson) => ({
      id: lesson.lessonId,
      title: lesson.lessonTitle,
      createdAt: lesson.lessonCreatedAt,
    })),
  };
}

export async function saveSubjectTemplateLessonsBatchAction(
  rawSubjectId: string,
  rawChapterId: string,
  rawInput: unknown,
  applyToExisting = true,
): Promise<SaveSubjectTemplateLessonsResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = batchSaveInputSchema.safeParse(rawInput);
  if (!subjectId.success || !chapterId.success) {
    return { ok: false, errors: ["Môn học hoặc chương không hợp lệ."] };
  }
  if (!input.success) return { ok: false, errors: zodMessages(input.error) };

  const duplicateTitles = new Set<string>();
  const seenTitles = new Set<string>();
  const normalizedLessons: Array<{ lessonTitle: string; markdownSource: string; lesson: NormalizedLesson }> = [];
  for (const item of input.data) {
    const normalized = normalizeLessonInput(item);
    if (!normalized.ok) return normalized;
    const titleKey = normalized.title.toLocaleLowerCase("vi");
    if (seenTitles.has(titleKey)) duplicateTitles.add(normalized.title);
    seenTitles.add(titleKey);
    normalizedLessons.push({ lessonTitle: normalized.title, markdownSource: normalized.source, lesson: normalized.lesson });
  }
  if (duplicateTitles.size > 0) {
    return { ok: false, errors: [`Tên Lesson bị trùng trong danh sách: ${[...duplicateTitles].join(", ")}.`] };
  }
  if (!await ownsTemplateLessonPlacement(subjectId.data, chapterId.data)) {
    return { ok: false, errors: ["Không tìm thấy môn học, chương hoặc bạn không có quyền truy cập."] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_subject_template_lessons_batch", {
    p_subject_id: subjectId.data,
    p_chapter_id: chapterId.data,
    p_lessons: normalizedLessons,
    p_apply_to_existing: applyToExisting,
  });
  const persisted = z.array(syncedLessonResultSchema).length(normalizedLessons.length).safeParse(data);
  if (error || !persisted.success) {
    return { ok: false, errors: ["Không thể lưu danh sách Lesson mẫu. Không có Lesson nào được tạo."] };
  }
  revalidatePath(`/teacher/subjects/${subjectId.data}`, "layout");
  revalidatePath(`/learn/subjects/${subjectId.data}`, "layout");
  return {
    ok: true,
    lessons: persisted.data.map((lesson) => ({
      id: lesson.lessonId,
      appliedCount: lesson.appliedCount,
      skippedCount: lesson.skippedCount,
    })),
  };
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

export async function saveSubjectTemplateLessonAction(
  rawSubjectId: string,
  rawChapterId: string,
  rawInput: unknown,
  applyToExisting = true,
): Promise<LessonMutationResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = normalizeLessonInput(rawInput);
  if (!subjectId.success || !chapterId.success) return { ok: false, errors: ["Môn học hoặc chương không hợp lệ."] };
  if (!input.ok) return input;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_subject_template_lesson_synced", {
    p_subject_id: subjectId.data,
    p_chapter_id: chapterId.data,
    p_lesson_title: input.title,
    p_markdown_source: input.source,
    p_lesson: input.lesson,
    p_apply_to_existing: applyToExisting,
  });
  const persisted = syncedLessonResultSchema.safeParse(data);
  if (error || !persisted.success) return { ok: false, errors: ["Không thể lưu Lesson mẫu. Hãy thử lại."] };
  revalidatePath(`/teacher/subjects/${subjectId.data}`, "layout");
  revalidatePath(`/learn/subjects/${subjectId.data}`, "layout");
  return { ok: true, ...persisted.data };
}

export async function updateSubjectTemplateLessonAction(
  rawSubjectId: string,
  rawLessonId: string,
  rawChapterId: string,
  rawInput: unknown,
  applyToExisting = true,
): Promise<LessonMutationResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const lessonId = lessonIdSchema.safeParse(rawLessonId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = normalizeLessonInput(rawInput);
  if (!subjectId.success || !lessonId.success || !chapterId.success) return { ok: false, errors: ["Lesson hoặc chương không hợp lệ."] };
  if (!input.ok) return input;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_subject_template_lesson_synced", {
    p_subject_id: subjectId.data,
    p_lesson_id: lessonId.data,
    p_chapter_id: chapterId.data,
    p_lesson_title: input.title,
    p_markdown_source: input.source,
    p_lesson: input.lesson,
    p_apply_to_existing: applyToExisting,
  });
  const persisted = syncedLessonResultSchema.safeParse(data);
  if (error || !persisted.success) return { ok: false, errors: ["Không thể cập nhật Lesson mẫu. Hãy thử lại."] };
  revalidatePath(`/teacher/subjects/${subjectId.data}`, "layout");
  revalidatePath(`/learn/subjects/${subjectId.data}`, "layout");
  return { ok: true, ...persisted.data };
}

export async function updateOwnedLessonAction(
  rawSubjectId: string,
  rawLessonId: string,
  rawChapterId: string,
  rawInput: unknown,
): Promise<LessonMutationResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const lessonId = lessonIdSchema.safeParse(rawLessonId);
  const chapterId = chapterIdSchema.safeParse(rawChapterId);
  const input = normalizeLessonInput(rawInput);
  if (!subjectId.success || !lessonId.success || !chapterId.success) return { ok: false, errors: ["Lesson hoặc chương không hợp lệ."] };
  if (!input.ok) return input;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_owned_lesson", {
    p_lesson_id: lessonId.data,
    p_chapter_id: chapterId.data,
    p_lesson_title: input.title,
    p_markdown_source: input.source,
    p_lesson: input.lesson,
  });
  if (error || data !== lessonId.data) {
    return { ok: false, errors: ["Không thể cập nhật Lesson. Lesson đã có lịch sử Session sẽ được giữ nguyên."] };
  }
  revalidatePath(`/teacher/subjects/${subjectId.data}`, "layout");
  return { ok: true, lessonId: lessonId.data };
}

export async function deleteOwnedLessonAction(
  rawSubjectId: string,
  rawCourseSectionId: string | null,
  rawLessonId: string,
  applyToExisting = true,
): Promise<LessonMutationResult> {
  await requireTeacher();
  const subjectId = subjectIdSchema.safeParse(rawSubjectId);
  const lessonId = lessonIdSchema.safeParse(rawLessonId);
  const courseSectionId = rawCourseSectionId === null ? null : courseSectionIdSchema.safeParse(rawCourseSectionId);
  if (!subjectId.success || !lessonId.success || (courseSectionId !== null && !courseSectionId.success)) {
    return { ok: false, errors: ["Lesson không hợp lệ."] };
  }
  const supabase = await createClient();
  const { data, error } = rawCourseSectionId === null
    ? await supabase.rpc("delete_subject_template_lesson_synced", {
        p_subject_id: subjectId.data,
        p_lesson_id: lessonId.data,
        p_apply_to_existing: applyToExisting,
      })
    : await supabase.rpc("delete_owned_lesson", { p_lesson_id: lessonId.data });
  const synced = rawCourseSectionId === null ? syncedLessonResultSchema.safeParse(data) : null;
  if (error || (rawCourseSectionId === null ? !synced?.success : data !== lessonId.data)) {
    return { ok: false, errors: ["Không thể xóa Lesson hoặc bạn không có quyền thực hiện thao tác này."] };
  }
  revalidatePath(`/teacher/subjects/${subjectId.data}`, "layout");
  if (rawCourseSectionId === null) revalidatePath(`/learn/subjects/${subjectId.data}`, "layout");
  if (courseSectionId !== null) revalidatePath(`/teacher/subjects/${subjectId.data}/sections/${courseSectionId.data}`);
  return synced?.success ? { ok: true, ...synced.data } : { ok: true, lessonId: lessonId.data };
}
