import "server-only";

import { z } from "zod";

import {
  endedLessonReviewSchema,
  publicCatalogLessonSchema,
  publicChapterSchema,
  publicChapterCatalogSchema,
  publicCourseSectionCatalogSchema,
  publicCourseSectionSchema,
  publicLessonGateContextSchema,
  publicLiveSessionSchema,
  publicSubjectSchema,
  publicSubjectCourseSectionsSchema,
  type PublicChapterCatalog,
  type PublicCourseSectionCatalog,
  type PublicCourseSection,
  type PublicCatalogLesson,
  type PublicChapter,
  type EndedLessonReview,
  type PublicLessonGateContext,
  type PublicLiveSession,
  type PublicSubject,
  type PublicSubjectCourseSections,
} from "@/features/catalog/schemas";
import { createClient } from "@/lib/supabase/server";
import { parseSessionReflectionRow } from "@/features/rooms/session-reflection";
import { sortSessionLessons } from "@/features/lessons/order";

const idSchema = z.string().uuid();
const sessionLessonLabelSchema = z.object({
  lesson_id: z.string().uuid(),
  lesson_title: z.string().min(1),
  chapter_name: z.string().min(1),
});

export async function getPublicLiveSessions(): Promise<PublicLiveSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_live_sessions");
  if (error) throw new Error("Không thể tải danh sách buổi học đang LIVE.");
  return z.array(publicLiveSessionSchema).parse(data);
}

export async function getPublicSubjects(): Promise<PublicSubject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_subjects");
  if (error) throw new Error("Không thể tải danh sách môn học.");
  return z.array(publicSubjectSchema).parse(data);
}

export async function getPublicCourseSections(rawSubjectId: string): Promise<PublicCourseSection[]> {
  const subjectId = idSchema.safeParse(rawSubjectId);
  if (!subjectId.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_sections", {
    p_subject_id: subjectId.data,
  });
  if (error) throw new Error("Không thể tải danh sách lớp học phần.");
  return z.array(publicCourseSectionSchema).parse(data);
}

export async function getPublicSubjectCourseSections(rawSubjectId: string): Promise<PublicSubjectCourseSections | null> {
  const subjectId = idSchema.safeParse(rawSubjectId);
  if (!subjectId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_subject_course_sections", {
    p_subject_id: subjectId.data,
  });
  if (error) throw new Error("Không thể tải môn học và danh sách lớp học phần.");
  const result = publicSubjectCourseSectionsSchema.safeParse(data);
  return result.success ? result.data : null;
}

export async function getPublicCourseSectionCatalog(
  rawSubjectId: string,
  rawCourseSectionId: string,
): Promise<PublicCourseSectionCatalog | null> {
  const subjectId = idSchema.safeParse(rawSubjectId);
  const courseSectionId = idSchema.safeParse(rawCourseSectionId);
  if (!subjectId.success || !courseSectionId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_section_catalog", {
    p_course_section_id: courseSectionId.data,
    p_subject_id: subjectId.data,
  });
  if (error) throw new Error("Không thể tải nội dung lớp học phần.");
  const result = publicCourseSectionCatalogSchema.safeParse(data);
  if (!result.success) return null;
  return { ...result.data, lessons: sortSessionLessons(result.data.lessons) };
}

export async function getPublicChapterCatalog(
  rawSubjectId: string,
  rawCourseSectionId: string,
  rawChapterId: string,
): Promise<PublicChapterCatalog | null> {
  const subjectId = idSchema.safeParse(rawSubjectId);
  const courseSectionId = idSchema.safeParse(rawCourseSectionId);
  const chapterId = idSchema.safeParse(rawChapterId);
  if (!subjectId.success || !courseSectionId.success || !chapterId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_chapter_catalog", {
    p_chapter_id: chapterId.data,
    p_course_section_id: courseSectionId.data,
    p_subject_id: subjectId.data,
  });
  if (error) throw new Error("Không thể tải thông tin chương.");
  const result = publicChapterCatalogSchema.safeParse(data);
  if (!result.success) return null;
  return { ...result.data, lessons: sortSessionLessons(result.data.lessons) };
}

export async function getPublicLessons(rawCourseSectionId: string): Promise<PublicCatalogLesson[]> {
  const courseSectionId = idSchema.safeParse(rawCourseSectionId);
  if (!courseSectionId.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_section_lessons", {
    p_course_section_id: courseSectionId.data,
  });
  if (error) throw new Error("Không thể tải danh sách Lesson.");
  return sortSessionLessons(z.array(publicCatalogLessonSchema).parse(data));
}

export async function getPublicChapters(rawCourseSectionId: string): Promise<PublicChapter[]> {
  const courseSectionId = idSchema.safeParse(rawCourseSectionId);
  if (!courseSectionId.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_section_chapters", {
    p_course_section_id: courseSectionId.data,
  });
  if (error) throw new Error("Không thể tải danh sách chương.");
  return z.array(publicChapterSchema).parse(data);
}

export async function getPublicLessonGateContext(rawLessonId: string): Promise<PublicLessonGateContext | null> {
  const lessonId = idSchema.safeParse(rawLessonId);
  if (!lessonId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_lesson_gate_context", {
    p_lesson_id: lessonId.data,
  });
  if (error) throw new Error("Không thể tải thông tin Lesson.");

  const row = Array.isArray(data) ? data[0] : null;
  return row ? publicLessonGateContextSchema.parse(row) : null;
}

export async function getStudentEndedLessonReview(
  rawSessionId: string,
  rawLessonId?: string,
): Promise<(EndedLessonReview & { subjectId: string; courseSectionId: string; participated: boolean }) | null> {
  const sessionId = idSchema.safeParse(rawSessionId);
  const lessonId = idSchema.safeParse(rawLessonId);
  if (!sessionId.success || !lessonId.success) return null;

  const supabase = await createClient();
  const [reviewResult, reflectionResult] = await Promise.all([
    supabase.rpc("get_student_ended_lesson_review", {
      p_room_id: sessionId.data,
      p_lesson_id: lessonId.data,
    }),
    supabase.rpc("get_own_session_reflection", { p_room_id: sessionId.data }),
  ]);
  const { data, error } = reviewResult;
  if (error) return null;

  if (reflectionResult.error && reflectionResult.error.code !== "42501") return null;
  const participated = !reflectionResult.error;
  let sessionReflection = null;
  const reflectionRow = Array.isArray(reflectionResult.data) ? reflectionResult.data[0] : null;
  if (participated && reflectionRow) {
    try {
      sessionReflection = parseSessionReflectionRow(reflectionRow);
    } catch {
      return null;
    }
  }

  const review = endedLessonReviewSchema.safeParse({
    ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}),
    sessionReflection,
  });
  if (!review.success) return null;

  const { data: contextData, error: contextError } = await supabase.rpc(
    "get_public_lesson_gate_context",
    { p_lesson_id: review.data.lessonId },
  );
  if (contextError) return null;

  const contextRow = Array.isArray(contextData) ? contextData[0] : null;
  const context = publicLessonGateContextSchema.safeParse(contextRow);
  if (!context.success) return null;

  return {
    ...review.data,
    subjectId: context.data.subject_id,
    courseSectionId: context.data.course_section_id,
    participated,
  };
}

export async function getStudentEndedSessionLessons(rawSessionId: string) {
  const sessionId = idSchema.safeParse(rawSessionId);
  if (!sessionId.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_student_session_lessons", {
    p_room_id: sessionId.data,
  });
  if (error) return [];

  const lessons = z.array(sessionLessonLabelSchema).safeParse(data);
  return lessons.success ? sortSessionLessons(lessons.data) : [];
}
