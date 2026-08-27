import { z } from "zod";

export const sessionReflectionSchema = z.object({
  id: z.string().uuid(),
  speakingCount: z.number().int().min(0).max(999),
  reviewBody: z.string().min(1).max(1000).nullable(),
  updatedAt: z.string(),
});

export const sessionReflectionRowSchema = z.object({
  reflection_id: z.string().uuid(),
  speaking_count: z.number().int().min(0).max(999),
  review_body: z.string().min(1).max(1000).nullable(),
  updated_at: z.string(),
});

export const teacherSessionReflectionSchema = z.object({
  id: z.string().uuid(),
  mssv: z.string().min(1),
  speakingCount: z.number().int().min(0).max(999),
  reviewBody: z.string().min(1).max(1000).nullable(),
  submittedAt: z.string(),
});

export const teacherSessionReflectionsSchema = z.object({
  roomId: z.string().uuid(),
  roomTitle: z.string().min(1),
  participantCount: z.number().int().nonnegative(),
  submittedCount: z.number().int().nonnegative(),
  reflections: z.array(teacherSessionReflectionSchema),
});

export type SessionReflection = z.infer<typeof sessionReflectionSchema>;
export type TeacherSessionReflections = z.infer<typeof teacherSessionReflectionsSchema>;

export function parseSessionReflectionRow(input: unknown): SessionReflection {
  const row = sessionReflectionRowSchema.parse(input);
  return sessionReflectionSchema.parse({
    id: row.reflection_id,
    speakingCount: row.speaking_count,
    reviewBody: row.review_body,
    updatedAt: row.updated_at,
  });
}
