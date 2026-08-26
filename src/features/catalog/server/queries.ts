import "server-only";

import { z } from "zod";

import {
  endedLessonReviewSchema,
  publicCatalogLessonSchema,
  publicChapterSchema,
  publicCourseSectionSchema,
  publicLessonGateContextSchema,
  publicSubjectSchema,
  type PublicCourseSection,
  type PublicCatalogLesson,
  type PublicChapter,
  type EndedLessonReview,
  type PublicLessonGateContext,
  type PublicSubject,
} from "@/features/catalog/schemas";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

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

export async function getPublicLessons(rawCourseSectionId: string): Promise<PublicCatalogLesson[]> {
  const courseSectionId = idSchema.safeParse(rawCourseSectionId);
  if (!courseSectionId.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_section_lessons", {
    p_course_section_id: courseSectionId.data,
  });
  if (error) throw new Error("Không thể tải danh sách Lesson.");
  return z.array(publicCatalogLessonSchema).parse(data);
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

export async function getStudentEndedLessonReview(rawSessionId: string): Promise<EndedLessonReview | null> {
  const sessionId = idSchema.safeParse(rawSessionId);
  if (!sessionId.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_student_ended_lesson_review", {
    p_room_id: sessionId.data,
  });
  if (error) return null;

  const review = endedLessonReviewSchema.safeParse(data);
  return review.success ? review.data : null;
}
