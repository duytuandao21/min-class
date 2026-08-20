import { z } from "zod";

import { teacherFeedbackSnapshotSchema } from "@/features/rooms/feedback";
import { teacherQuizAnalyticsSchema } from "@/features/rooms/quiz";
import { roomCodeSchema } from "@/features/rooms/schemas";

export const teacherRoomSummarySchema = z.object({
  room: z.object({
    id: z.string().uuid(),
    code: roomCodeSchema,
    title: z.string().min(1),
    startedAt: z.string(),
    endedAt: z.string(),
  }),
  participantCount: z.number().int().nonnegative(),
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
