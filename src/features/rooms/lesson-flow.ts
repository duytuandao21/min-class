import { z } from "zod";

export const lessonSectionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]),
  title: z.string().min(1),
  contentMd: z.string(),
});

export const studentLessonSnapshotSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: z.enum(["ACTIVE", "ENDED"]),
  releasedThrough: z.number().int(),
  teachingSection: z.number().int().nonnegative(),
  presentationRevision: z.number().int().nonnegative(),
  sections: z.array(lessonSectionSchema),
});

const studentSnapshotRowSchema = z.object({
  room_id: z.string().uuid(),
  room_title: z.string().min(1),
  room_status: z.enum(["ACTIVE", "ENDED"]),
  released_through: z.number().int(),
  teaching_section: z.number().int().nonnegative(),
  presentation_revision: z.number().int().nonnegative(),
  section_id: z.string().uuid().nullable(),
  section_position: z.number().int().nonnegative().nullable(),
  section_type: z.enum(["CONTENT", "QUIZ", "REFLECTION"]).nullable(),
  section_title: z.string().nullable(),
  section_content_md: z.string().nullable(),
});

export type LessonSection = z.infer<typeof lessonSectionSchema>;
export type StudentLessonSnapshot = z.infer<typeof studentLessonSnapshotSchema>;
export type TeacherSectionViewMode = "TEACHING" | "REVIEW" | "PREVIEW";

export function getTeacherSectionViewMode(
  viewingPosition: number,
  teachingPosition: number,
  releasedThrough = teachingPosition,
): TeacherSectionViewMode {
  if (viewingPosition === teachingPosition) return "TEACHING";
  return viewingPosition <= releasedThrough ? "REVIEW" : "PREVIEW";
}

export function getAdjacentSectionPosition(
  sections: readonly LessonSection[],
  currentPosition: number,
  offset: -1 | 1,
): number | null {
  const currentIndex = sections.findIndex((section) => section.position === currentPosition);
  if (currentIndex < 0) return sections[0]?.position ?? null;
  return sections[currentIndex + offset]?.position ?? null;
}

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
    title: first.room_title,
    status: first.room_status,
    releasedThrough: first.released_through,
    teachingSection: first.teaching_section,
    presentationRevision: first.presentation_revision,
    sections,
  });
}

export function getStudentPresentationPosition(snapshot: StudentLessonSnapshot): number | null {
  if (snapshot.status === "ACTIVE"
    && snapshot.sections.some((section) => section.position === snapshot.teachingSection)) {
    return snapshot.teachingSection;
  }
  return snapshot.sections.at(-1)?.position ?? null;
}

export function reconcileStudentPosition(
  currentPosition: number | null,
  previousSnapshot: StudentLessonSnapshot,
  nextSnapshot: StudentLessonSnapshot,
): number | null {
  const presentationChanged = nextSnapshot.status === "ACTIVE" && (
    nextSnapshot.presentationRevision !== previousSnapshot.presentationRevision
    || nextSnapshot.teachingSection !== previousSnapshot.teachingSection
    || nextSnapshot.releasedThrough !== previousSnapshot.releasedThrough
  );
  if (presentationChanged || currentPosition === null) {
    return getStudentPresentationPosition(nextSnapshot);
  }
  return nextSnapshot.sections.some((section) => section.position === currentPosition)
    ? currentPosition
    : getStudentPresentationPosition(nextSnapshot);
}
