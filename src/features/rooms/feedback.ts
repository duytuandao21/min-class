import { z } from "zod";

export const reactionSchema = z.enum(["UNDERSTAND", "UNSURE", "QUESTION"]);

export const reactionOptions = [
  { value: "UNDERSTAND", emoji: "👍", label: "Hiểu" },
  { value: "UNSURE", emoji: "🤔", label: "Chưa chắc" },
  { value: "QUESTION", emoji: "❓", label: "Có câu hỏi" },
] as const satisfies ReadonlyArray<{
  value: z.infer<typeof reactionSchema>;
  emoji: string;
  label: string;
}>;

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Comment không được để trống.")
  .max(500, "Comment không được dài quá 500 ký tự.");

const reactionResultSchema = z.object({
  section_id: z.string().uuid(),
  reaction: reactionSchema,
  updated_at: z.string(),
});

const commentResultSchema = z.object({
  comment_id: z.string().uuid(),
  section_id: z.string().uuid(),
  created_at: z.string(),
});

const ownReactionRowSchema = z.object({
  section_id: z.string().uuid(),
  reaction: reactionSchema,
});

const feedbackReactionSchema = z.object({
  sectionId: z.string().uuid(),
  sectionPosition: z.number().int().nonnegative(),
  sectionTitle: z.string(),
  understand: z.number().int().nonnegative(),
  unsure: z.number().int().nonnegative(),
  question: z.number().int().nonnegative(),
});

const feedbackCommentSchema = z.object({
  id: z.string().uuid(),
  sectionId: z.string().uuid(),
  sectionPosition: z.number().int().nonnegative(),
  sectionTitle: z.string(),
  body: z.string(),
  authorLabel: z.string(),
  isAnonymous: z.boolean(),
  createdAt: z.string(),
});

export const teacherFeedbackSnapshotSchema = z.object({
  reactions: z.array(feedbackReactionSchema),
  comments: z.array(feedbackCommentSchema),
});

export type Reaction = z.infer<typeof reactionSchema>;
export type TeacherFeedbackSnapshot = z.infer<typeof teacherFeedbackSnapshotSchema>;
export type OwnReactions = Partial<Record<string, Reaction>>;

export function parseReactionResult(input: unknown) {
  return z.array(reactionResultSchema).min(1).parse(input)[0];
}

export function parseCommentResult(input: unknown) {
  return z.array(commentResultSchema).min(1).parse(input)[0];
}

export function parseOwnReactions(input: unknown): OwnReactions {
  const rows = z.array(ownReactionRowSchema).parse(input);
  return Object.fromEntries(rows.map((row) => [row.section_id, row.reaction]));
}

export function parseTeacherFeedbackSnapshot(input: unknown): TeacherFeedbackSnapshot {
  return teacherFeedbackSnapshotSchema.parse(input);
}
