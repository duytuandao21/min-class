import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "chỉ được dùng chữ thường, số, '-' và '_'");

export const normalizedQuizOptionSchema = z.object({
  id: identifierSchema,
  position: z.number().int().nonnegative(),
  content: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

export const normalizedQuizQuestionSchema = z.object({
  id: identifierSchema,
  position: z.number().int().nonnegative(),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
  questionText: z.string().trim().min(1).max(1000),
  options: z.array(normalizedQuizOptionSchema).min(2),
});

const normalizedSectionBaseSchema = z.object({
  id: identifierSchema,
  position: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(200),
});

export const normalizedContentSectionSchema = normalizedSectionBaseSchema.extend({
  type: z.enum(["CONTENT", "REFLECTION"]),
  contentMd: z.string().trim().min(1),
});

export const normalizedQuizSectionSchema = normalizedSectionBaseSchema.extend({
  type: z.literal("QUIZ"),
  contentMd: z.literal(""),
  quiz: z.object({
    questions: z.array(normalizedQuizQuestionSchema).min(1),
  }),
});

export const normalizedLessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable(),
  sections: z
    .array(z.discriminatedUnion("type", [normalizedContentSectionSchema, normalizedQuizSectionSchema]))
    .min(1),
});

export type NormalizedLesson = z.infer<typeof normalizedLessonSchema>;
export type NormalizedLessonSection = NormalizedLesson["sections"][number];
export type NormalizedQuizQuestion = z.infer<typeof normalizedQuizQuestionSchema>;
