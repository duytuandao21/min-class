import { describe, expect, it } from "vitest";

import {
  buildPresentationSteps,
  classVoicesSnapshotSchema,
  filterClassVoiceLessons,
  flattenClassVoices,
  groupClassVoicesByLesson,
  nextPresentationIndex,
} from "./class-voices";

const snapshot = classVoicesSnapshotSchema.parse({
  roomId: "39000000-0000-4000-8000-000000000001",
  roomTitle: "Class Voices",
  participantCount: 42,
  sections: [
    {
      lessonId: "49000000-0000-4000-8000-000000000002",
      lessonTitle: "Bài 2",
      sectionId: "59000000-0000-4000-8000-000000000001",
      sectionPosition: 0,
      sectionTitle: "Opening",
      reactions: { understand: 30, unsure: 8, question: 4 },
      comments: [
        {
          id: "79000000-0000-4000-8000-000000000001",
          body: "Named voice",
          authorLabel: "SV001",
          isAnonymous: false,
          createdAt: "2026-08-20T01:00:00Z",
        },
        {
          id: "79000000-0000-4000-8000-000000000002",
          body: "Anonymous voice",
          authorLabel: "Anonymous",
          isAnonymous: true,
          createdAt: "2026-08-20T01:01:00Z",
        },
      ],
    },
    {
      lessonId: "49000000-0000-4000-8000-000000000002",
      lessonTitle: "Bài 2",
      sectionId: "59000000-0000-4000-8000-000000000002",
      sectionPosition: 1,
      sectionTitle: "No comments",
      reactions: { understand: 20, unsure: 15, question: 7 },
      comments: [],
    },
    {
      lessonId: "49000000-0000-4000-8000-000000000001",
      lessonTitle: "Bài 1",
      sectionId: "59000000-0000-4000-8000-000000000003",
      sectionPosition: 2,
      sectionTitle: "No feedback",
      reactions: { understand: 0, unsure: 0, question: 0 },
      comments: [],
    },
  ],
});

describe("Class Voices contract", () => {
  it("flattens comments in section order for Presentation Mode", () => {
    expect(flattenClassVoices(snapshot).map((voice) => voice.body)).toEqual([
      "Named voice",
      "Anonymous voice",
    ]);
  });

  it("keeps database-provided masked author labels", () => {
    const voices = flattenClassVoices(snapshot);
    expect(voices[0]?.authorLabel).toBe("SV001");
    expect(voices[1]?.authorLabel).toBe("Anonymous");
    expect(voices[1]?.isAnonymous).toBe(true);
  });

  it("groups sections by Lesson in natural Lesson order", () => {
    const lessons = groupClassVoicesByLesson(snapshot);
    expect(lessons.map((lesson) => lesson.lessonTitle)).toEqual(["Bài 1", "Bài 2"]);
    expect(lessons[1]?.sections.map((section) => section.sectionTitle)).toEqual([
      "Opening",
      "No comments",
    ]);
  });

  it("filters the Voice Wall to one Lesson", () => {
    const lessons = filterClassVoiceLessons(snapshot, "49000000-0000-4000-8000-000000000002");
    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.lessonTitle).toBe("Bài 2");
  });

  it("builds Intro, Section, Reaction, Comment and Final presentation steps", () => {
    const steps = buildPresentationSteps(snapshot);
    expect(steps.map((step) => step.type)).toEqual([
      "INTRO",
      "LESSON_INTRO",
      "SECTION_INTRO",
      "REACTION_OVERVIEW",
      "COMMENT_SPOTLIGHT",
      "COMMENT_SPOTLIGHT",
      "SECTION_INTRO",
      "REACTION_OVERVIEW",
      "FINAL",
    ]);
  });

  it("does not present Sections without reactions or comments", () => {
    expect(JSON.stringify(buildPresentationSteps(snapshot))).not.toContain("No feedback");
  });

  it("keeps Previous and Next inside the presentation timeline", () => {
    expect(nextPresentationIndex(0, -1, 8)).toBe(0);
    expect(nextPresentationIndex(0, 1, 8)).toBe(1);
    expect(nextPresentationIndex(7, 1, 8)).toBe(7);
  });

  it("returns no presentation for an entirely empty Session", () => {
    const empty = classVoicesSnapshotSchema.parse({
      ...snapshot,
      participantCount: 0,
      sections: snapshot.sections.map((section) => ({
        ...section,
        reactions: { understand: 0, unsure: 0, question: 0 },
        comments: [],
      })),
    });
    expect(buildPresentationSteps(empty)).toEqual([]);
  });
});
