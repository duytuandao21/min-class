import { z } from "zod";

import { teacherFeedbackSnapshotSchema } from "@/features/rooms/feedback";
import { teacherQuizAnalyticsSchema } from "@/features/rooms/quiz";

export const teacherAttendanceSchema = z.object({
  rosterCount: z.number().int().nonnegative(),
  joinedCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  absentMssvs: z.array(z.string()),
});

const summaryCommentsSchema = z.object({
  total: z.number().int().nonnegative(),
  anonymous: z.number().int().nonnegative(),
  named: z.number().int().nonnegative(),
});

const mostEngagedSectionSchema = z.object({
  sectionId: z.string().uuid(),
  sectionPosition: z.number().int().nonnegative(),
  sectionTitle: z.string(),
  totalFeedback: z.number().int().positive(),
}).nullable();

export const teacherRoomSummaryOverviewSchema = z.object({
  room: z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    startedAt: z.string(),
    endedAt: z.string(),
  }),
  attendance: teacherAttendanceSchema.omit({ absentMssvs: true }),
  comments: summaryCommentsSchema,
  mostEngagedSection: mostEngagedSectionSchema,
  lessonContext: z.object({
    lessonId: z.string().uuid(),
    courseSectionId: z.string().uuid(),
    subjectId: z.string().uuid(),
  }).nullable(),
});

export const teacherRoomAttendanceDetailSchema = z.object({
  participants: z.array(z.object({
    mssv: z.string(),
    joinedAt: z.string(),
  })),
  absentMssvs: z.array(z.string()),
});

export const teacherRoomSummaryLessonListSchema = z.array(z.object({
  lessonId: z.string().uuid(),
  lessonTitle: z.string().min(1),
  sectionCount: z.number().int().nonnegative(),
  quizCount: z.number().int().nonnegative(),
}));

export const teacherLessonSummarySchema = z.object({
  lessonId: z.string().uuid(),
  lessonTitle: z.string().min(1),
  reactions: teacherFeedbackSnapshotSchema.shape.reactions,
  quizzes: teacherQuizAnalyticsSchema.shape.quizzes,
});

export const teacherRoomSummarySchema = z.object({
  room: z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    startedAt: z.string(),
    endedAt: z.string(),
  }),
  participantCount: z.number().int().nonnegative(),
  attendance: teacherAttendanceSchema,
  participants: z.array(z.object({
    mssv: z.string(),
    joinedAt: z.string(),
  })),
  quizzes: teacherQuizAnalyticsSchema.shape.quizzes,
  reactions: teacherFeedbackSnapshotSchema.shape.reactions,
  comments: summaryCommentsSchema,
  mostEngagedSection: mostEngagedSectionSchema,
});

export type TeacherRoomSummary = z.infer<typeof teacherRoomSummarySchema>;
export type TeacherAttendance = z.infer<typeof teacherAttendanceSchema>;
export type TeacherRoomSummaryOverview = z.infer<typeof teacherRoomSummaryOverviewSchema>;
export type TeacherRoomAttendanceDetail = z.infer<typeof teacherRoomAttendanceDetailSchema>;
export type TeacherRoomSummaryLessonList = z.infer<typeof teacherRoomSummaryLessonListSchema>;

export type TeacherLessonSummary = z.infer<typeof teacherLessonSummarySchema>;

export function groupTeacherSummaryByLesson(
  summary: Pick<TeacherRoomSummary, "reactions" | "quizzes">,
  lessons: ReadonlyArray<{
    lessonId: string;
    lessonTitle: string;
    sectionIds: readonly string[];
  }>,
): TeacherLessonSummary[] {
  return lessons.map((lesson) => {
    const sectionIds = new Set(lesson.sectionIds);
    return {
      lessonId: lesson.lessonId,
      lessonTitle: lesson.lessonTitle,
      reactions: summary.reactions.filter((reaction) => sectionIds.has(reaction.sectionId)),
      quizzes: summary.quizzes.filter((quiz) => sectionIds.has(quiz.sectionId)),
    };
  });
}
