import { z } from "zod";

export const quizQuestionTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
]);

const quizOptionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  content: z.string().min(1),
});

const quizQuestionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: quizQuestionTypeSchema,
  questionText: z.string().min(1),
  options: z.array(quizOptionSchema).min(2),
});

const quizAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  score: z.number().int().nonnegative(),
  totalQuestions: z.number().int().positive(),
  submittedAt: z.string(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()),
    correctOptionIds: z.array(z.string().uuid()).min(1),
    isCorrect: z.boolean(),
  })).default([]),
});

export const studentQuizSnapshotSchema = z.object({
  quizId: z.string().uuid(),
  sectionId: z.string().uuid(),
  title: z.string().min(1),
  questions: z.array(quizQuestionSchema).min(1),
  attempt: quizAttemptSchema.nullable(),
});

const quizAnswerSchema = z.object({
  question_id: z.string().uuid(),
  selected_option_ids: z.array(z.string().uuid()).min(1),
});

export const quizSubmissionSchema = z.array(quizAnswerSchema).min(1);

const quizSubmissionResultSchema = z.object({
  attempt_id: z.string().uuid(),
  score: z.number().int().nonnegative(),
  total_questions: z.number().int().positive(),
});

const quizAnalyticsOptionSchema = z.object({
  optionId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  content: z.string(),
  selectionCount: z.number().int().nonnegative(),
});

const quizAnalyticsQuestionSchema = z.object({
  questionId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: quizQuestionTypeSchema,
  questionText: z.string(),
  correctPercentage: z.number().min(0).max(100),
  options: z.array(quizAnalyticsOptionSchema),
});

const quizAnalyticsItemSchema = z.object({
  quizId: z.string().uuid(),
  sectionId: z.string().uuid(),
  sectionPosition: z.number().int().nonnegative(),
  title: z.string(),
  submittedCount: z.number().int().nonnegative(),
  participantCount: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(100),
  averageScore: z.number().nonnegative(),
  totalQuestions: z.number().int().positive(),
  questions: z.array(quizAnalyticsQuestionSchema),
});

export const teacherQuizAnalyticsSchema = z.object({
  quizzes: z.array(quizAnalyticsItemSchema),
});

export type StudentQuizSnapshot = z.infer<typeof studentQuizSnapshotSchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
export type QuizSubmissionResult = z.infer<typeof quizSubmissionResultSchema>;
export type TeacherQuizAnalytics = z.infer<typeof teacherQuizAnalyticsSchema>;

export function parseQuizSubmissionResult(input: unknown): QuizSubmissionResult {
  return z.array(quizSubmissionResultSchema).min(1).parse(input)[0];
}

export function filterTeacherQuizAnalyticsBySections(
  analytics: TeacherQuizAnalytics,
  sectionIds: readonly string[],
): TeacherQuizAnalytics {
  const visibleSectionIds = new Set(sectionIds);
  return {
    quizzes: analytics.quizzes.filter((quiz) => visibleSectionIds.has(quiz.sectionId)),
  };
}
