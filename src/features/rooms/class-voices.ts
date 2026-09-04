import { z } from "zod";

import { sortSessionLessons } from "@/features/lessons/order";

const classVoiceCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1).max(500),
  authorLabel: z.string().min(1),
  isAnonymous: z.boolean(),
  createdAt: z.string(),
});

const classVoiceSectionSchema = z.object({
  lessonId: z.string().uuid(),
  lessonTitle: z.string().min(1),
  sectionId: z.string().uuid(),
  sectionPosition: z.number().int().nonnegative(),
  sectionTitle: z.string().min(1),
  reactions: z.object({
    understand: z.number().int().nonnegative(),
    unsure: z.number().int().nonnegative(),
    question: z.number().int().nonnegative(),
  }),
  comments: z.array(classVoiceCommentSchema),
});

export const classVoicesSnapshotSchema = z.object({
  roomId: z.string().uuid(),
  roomTitle: z.string().min(1),
  participantCount: z.number().int().nonnegative(),
  sections: z.array(classVoiceSectionSchema),
});

export type ClassVoicesSnapshot = z.infer<typeof classVoicesSnapshotSchema>;
export type ClassVoice = z.infer<typeof classVoiceCommentSchema> & {
  sectionId: string;
  sectionPosition: number;
  sectionTitle: string;
};
export type ClassVoiceSection = ClassVoicesSnapshot["sections"][number];
export type ClassVoiceLesson = {
  lessonId: string;
  lessonTitle: string;
  sections: ClassVoiceSection[];
};
export type PresentationStep =
  | { type: "INTRO" }
  | { type: "LESSON_INTRO"; lesson: ClassVoiceLesson; lessonNumber: number }
  | { type: "SECTION_INTRO"; section: ClassVoiceSection }
  | { type: "REACTION_OVERVIEW"; section: ClassVoiceSection }
  | { type: "COMMENT_SPOTLIGHT"; section: ClassVoiceSection; comment: ClassVoiceSection["comments"][number] }
  | { type: "FINAL" };

export function flattenClassVoices(snapshot: ClassVoicesSnapshot): ClassVoice[] {
  return snapshot.sections.flatMap((section) => section.comments.map((comment) => ({
    ...comment,
    sectionId: section.sectionId,
    sectionPosition: section.sectionPosition,
    sectionTitle: section.sectionTitle,
  })));
}

export function countSectionReactions(section: ClassVoiceSection): number {
  return section.reactions.understand + section.reactions.unsure + section.reactions.question;
}

export function groupClassVoicesByLesson(snapshot: ClassVoicesSnapshot): ClassVoiceLesson[] {
  const lessons = new Map<string, ClassVoiceLesson>();
  for (const section of snapshot.sections) {
    const lesson = lessons.get(section.lessonId) ?? {
      lessonId: section.lessonId,
      lessonTitle: section.lessonTitle,
      sections: [],
    };
    lesson.sections.push(section);
    lessons.set(section.lessonId, lesson);
  }

  return sortSessionLessons(
    [...lessons.values()].map((lesson) => ({
      lesson_id: lesson.lessonId,
      lesson_title: lesson.lessonTitle,
      lesson: {
        ...lesson,
        sections: [...lesson.sections].sort((left, right) => left.sectionPosition - right.sectionPosition),
      },
    })),
  ).map((item) => item.lesson);
}

export function filterClassVoiceLessons(
  snapshot: ClassVoicesSnapshot,
  lessonId: string,
): ClassVoiceLesson[] {
  const lessons = groupClassVoicesByLesson(snapshot);
  return lessons.filter((lesson) => lesson.lessonId === lessonId);
}

export function buildPresentationSteps(snapshot: ClassVoicesSnapshot): PresentationStep[] {
  const meaningfulLessons = groupClassVoicesByLesson(snapshot)
    .map((lesson, lessonIndex) => ({
      ...lesson,
      lessonNumber: lessonIndex + 1,
      sections: lesson.sections.filter(
        (section) => section.comments.length > 0 || countSectionReactions(section) > 0,
      ),
    }))
    .filter((lesson) => lesson.sections.length > 0);
  if (meaningfulLessons.length === 0) return [];

  return [
    { type: "INTRO" },
    ...meaningfulLessons.flatMap((lesson): PresentationStep[] => [
      { type: "LESSON_INTRO", lesson, lessonNumber: lesson.lessonNumber },
      ...lesson.sections.flatMap((section): PresentationStep[] => [
        { type: "SECTION_INTRO", section },
        { type: "REACTION_OVERVIEW", section },
        ...section.comments.map((comment): PresentationStep => ({
          type: "COMMENT_SPOTLIGHT",
          section,
          comment,
        })),
      ]),
    ]),
    { type: "FINAL" },
  ];
}

export function nextPresentationIndex(
  currentIndex: number,
  direction: -1 | 1,
  stepCount: number,
): number {
  if (stepCount <= 0) return 0;
  return Math.min(Math.max(currentIndex + direction, 0), stepCount - 1);
}
