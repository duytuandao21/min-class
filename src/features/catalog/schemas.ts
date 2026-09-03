import { z } from "zod";

import { sessionReflectionSchema } from "@/features/rooms/session-reflection";

export const lessonStatusSchema = z.enum(["UPCOMING", "LIVE", "ENDED"]);
export type PublicLessonStatus = z.infer<typeof lessonStatusSchema>;

export const publicSubjectSchema = z.object({
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  subject_code: z.string().nullable(),
});

export const publicCourseSectionSchema = z.object({
  course_section_id: z.string().uuid(),
  section_code: z.string(),
  display_name: z.string().nullable(),
});

export const publicLessonSchema = z.object({
  lesson_id: z.string().uuid(),
  lesson_title: z.string(),
  lesson_status: lessonStatusSchema,
});

export const publicCatalogLessonSchema = publicLessonSchema.extend({
  chapter_id: z.string().uuid(),
});

export const publicChapterSchema = z.object({
  chapter_id: z.string().uuid(),
  chapter_name: z.string().min(1),
});

export const publicLiveSessionSchema = z.object({
  session_id: z.string().uuid(),
  subject_name: z.string().min(1),
  section_code: z.string().min(1),
  section_display_name: z.string().nullable(),
  chapter_name: z.string().min(1),
  first_lesson_id: z.string().uuid(),
  lesson_count: z.number().int().positive(),
  started_at: z.string(),
});

export const publicLessonGateContextSchema = publicLessonSchema.extend({
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  course_section_id: z.string().uuid(),
  section_code: z.string(),
  section_display_name: z.string().nullable(),
});

const endedLessonReviewOptionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  content: z.string().min(1),
  isCorrect: z.boolean(),
  isSelected: z.boolean(),
});

const endedLessonReviewQuestionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
  questionText: z.string().min(1),
  isCorrect: z.boolean().nullable(),
  options: z.array(endedLessonReviewOptionSchema).min(2),
});

const endedLessonReviewQuizSchema = z.object({
  quizId: z.string().uuid(),
  title: z.string().min(1),
  attempt: z.object({
    score: z.number().int().nonnegative(),
    totalQuestions: z.number().int().positive(),
    submittedAt: z.string(),
  }).nullable(),
  questions: z.array(endedLessonReviewQuestionSchema).min(1),
});

const endedLessonReviewSectionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]),
  title: z.string().min(1),
  contentMd: z.string(),
  quiz: endedLessonReviewQuizSchema.nullable(),
});

export const endedLessonReviewSchema = z.object({
  sessionId: z.string().uuid(),
  lessonId: z.string().uuid(),
  title: z.string().min(1),
  endedAt: z.string(),
  mssv: z.string().min(1),
  sessionReflection: sessionReflectionSchema.nullable(),
  sections: z.array(endedLessonReviewSectionSchema).min(1),
});

export const lessonAccessInputSchema = z.object({
  lessonId: z.string().uuid("Lesson không hợp lệ."),
  mssv: z.string().trim().toUpperCase().regex(
    /^[A-Z0-9][A-Z0-9._-]{2,31}$/,
    "MSSV cần 3–32 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.",
  ),
});

export type PublicSubject = z.infer<typeof publicSubjectSchema>;
export type PublicCourseSection = z.infer<typeof publicCourseSectionSchema>;
export type PublicLesson = z.infer<typeof publicLessonSchema>;
export type PublicCatalogLesson = z.infer<typeof publicCatalogLessonSchema>;
export type PublicChapter = z.infer<typeof publicChapterSchema>;
export type PublicLiveSession = z.infer<typeof publicLiveSessionSchema>;
export type PublicLessonGateContext = z.infer<typeof publicLessonGateContextSchema>;
export type EndedLessonReview = z.infer<typeof endedLessonReviewSchema>;
