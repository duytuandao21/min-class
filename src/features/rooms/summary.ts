import { z } from "zod";

import { teacherFeedbackSnapshotSchema } from "@/features/rooms/feedback";
import { teacherQuizAnalyticsSchema } from "@/features/rooms/quiz";

export const teacherAttendanceSchema = z.object({
  rosterCount: z.number().int().nonnegative(),
  joinedCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  absentMssvs: z.array(z.string()),
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
  comments: z.object({
    total: z.number().int().nonnegative(),
    anonymous: z.number().int().nonnegative(),
    named: z.number().int().nonnegative(),
  }),
  mostEngagedSection: z.object({
    sectionId: z.string().uuid(),
    sectionPosition: z.number().int().nonnegative(),
    sectionTitle: z.string(),
    totalFeedback: z.number().int().positive(),
  }).nullable(),
});

export type TeacherRoomSummary = z.infer<typeof teacherRoomSummarySchema>;
export type TeacherAttendance = z.infer<typeof teacherAttendanceSchema>;

export type TeacherLessonSummary = {
  lessonId: string;
  lessonTitle: string;
  reactions: TeacherRoomSummary["reactions"];
  quizzes: TeacherRoomSummary["quizzes"];
};

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
