import { z } from "zod";

import { roomCodeSchema } from "./schemas";

export const lessonSectionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]),
  title: z.string().min(1),
  contentMd: z.string(),
});

export const studentLessonSnapshotSchema = z.object({
  id: z.string().uuid(),
  code: roomCodeSchema,
  title: z.string().min(1),
  status: z.enum(["ACTIVE", "ENDED"]),
  releasedThrough: z.number().int(),
  sections: z.array(lessonSectionSchema),
});

const studentSnapshotRowSchema = z.object({
  room_id: z.string().uuid(),
  room_code: roomCodeSchema,
  room_title: z.string().min(1),
  room_status: z.enum(["ACTIVE", "ENDED"]),
  released_through: z.number().int(),
  section_id: z.string().uuid().nullable(),
  section_position: z.number().int().nonnegative().nullable(),
  section_type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]).nullable(),
  section_title: z.string().nullable(),
  section_content_md: z.string().nullable(),
});

export type LessonSection = z.infer<typeof lessonSectionSchema>;
export type StudentLessonSnapshot = z.infer<typeof studentLessonSnapshotSchema>;

export function parseStudentLessonSnapshot(input: unknown): StudentLessonSnapshot {
  const rows = z.array(studentSnapshotRowSchema).min(1).parse(input);
  const first = rows[0];
  const sections = rows.flatMap((row): LessonSection[] => {
    if (
      row.section_id === null
      || row.section_position === null
      || row.section_type === null
      || row.section_title === null
      || row.section_content_md === null
    ) {
      return [];
    }
    return [{
      id: row.section_id,
      position: row.section_position,
      type: row.section_type,
      title: row.section_title,
      contentMd: row.section_content_md,
    }];
  });

  return studentLessonSnapshotSchema.parse({
    id: first.room_id,
    code: first.room_code,
    title: first.room_title,
    status: first.room_status,
    releasedThrough: first.released_through,
    sections,
  });
}

export function reconcileStudentPosition(
  currentPosition: number | null,
  previousSections: LessonSection[],
  nextSections: LessonSection[],
): number | null {
  if (nextSections.length === 0) return null;

  const previousLatest = previousSections.at(-1)?.position ?? null;
  const nextLatest = nextSections.at(-1)?.position ?? null;
  if (nextLatest === null) return null;

  if (currentPosition === null || previousLatest === null || currentPosition === previousLatest) {
    return nextLatest;
  }

  return nextSections.some((section) => section.position === currentPosition)
    ? currentPosition
    : nextLatest;
}
