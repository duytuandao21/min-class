import { z } from "zod";

import { roomCodeSchema } from "./schemas";

const classVoiceCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1).max(500),
  authorLabel: z.string().min(1),
  isAnonymous: z.boolean(),
  createdAt: z.string(),
});

const classVoiceSectionSchema = z.object({
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
  roomCode: roomCodeSchema,
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
export type ClassVoicesFilter = "ALL" | string;
export type PresentationStep =
  | { type: "INTRO" }
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

export function filterClassVoiceSections(
  snapshot: ClassVoicesSnapshot,
  filter: ClassVoicesFilter,
): ClassVoiceSection[] {
  return filter === "ALL"
    ? snapshot.sections
    : snapshot.sections.filter((section) => section.sectionId === filter);
}

export function buildPresentationSteps(snapshot: ClassVoicesSnapshot): PresentationStep[] {
  const meaningfulSections = snapshot.sections.filter(
    (section) => section.comments.length > 0 || countSectionReactions(section) > 0,
  );
  if (meaningfulSections.length === 0) return [];

  return [
    { type: "INTRO" },
    ...meaningfulSections.flatMap((section): PresentationStep[] => [
      { type: "SECTION_INTRO", section },
      { type: "REACTION_OVERVIEW", section },
      ...section.comments.map((comment): PresentationStep => ({
        type: "COMMENT_SPOTLIGHT",
        section,
        comment,
      })),
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
