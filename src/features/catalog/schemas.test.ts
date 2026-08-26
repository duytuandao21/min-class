import { describe, expect, it } from "vitest";

import {
  endedLessonReviewSchema,
  lessonAccessInputSchema,
  lessonStatusSchema,
  publicCatalogLessonSchema,
  publicChapterSchema,
} from "./schemas";

describe("public Lesson access input", () => {
  it("normalizes a valid MSSV and LIVE session code", () => {
    const result = lessonAccessInputSchema.parse({
      lessonId: "ae300000-0000-4000-8000-000000000002",
      mssv: " 23110001 ",
      sessionCode: " lvac24 ",
    });

    expect(result.mssv).toBe("23110001");
    expect(result.sessionCode).toBe("LVAC24");
  });

  it("allows the missing FormData session code for the ENDED gate", () => {
    const result = lessonAccessInputSchema.safeParse({
      lessonId: "ae300000-0000-4000-8000-000000000003",
      mssv: "23110001",
      sessionCode: null,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sessionCode).toBeUndefined();
  });

  it("also normalizes a blank session code", () => {
    const result = lessonAccessInputSchema.parse({
      lessonId: "ae300000-0000-4000-8000-000000000003",
      mssv: "23110001",
      sessionCode: " ",
    });

    expect(result.sessionCode).toBeUndefined();
  });

  it("rejects invalid MSSV and ambiguous session-code characters", () => {
    expect(lessonAccessInputSchema.safeParse({
      lessonId: "ae300000-0000-4000-8000-000000000002",
      mssv: "BAD!",
      sessionCode: "LIVEO1",
    }).success).toBe(false);
  });
});

describe("public Lesson status", () => {
  it.each(["UPCOMING", "LIVE", "ENDED"])("accepts %s", (status) => {
    expect(lessonStatusSchema.parse(status)).toBe(status);
  });
});

describe("public Chapter catalog", () => {
  it("parses a sanitized Chapter and its Lesson relation", () => {
    const chapterId = "ae250000-0000-4000-8000-000000000001";

    expect(publicChapterSchema.parse({ chapter_id: chapterId, chapter_name: "Chương 1" })).toEqual({
      chapter_id: chapterId,
      chapter_name: "Chương 1",
    });
    expect(publicCatalogLessonSchema.parse({
      chapter_id: chapterId,
      lesson_id: "ae300000-0000-4000-8000-000000000001",
      lesson_title: "Giới thiệu",
      lesson_status: "UPCOMING",
    }).chapter_id).toBe(chapterId);
  });
});

describe("ended Lesson review", () => {
  it("parses correct answers and the Student own selection", () => {
    const review = endedLessonReviewSchema.parse({
      sessionId: "ae300000-0000-4000-8000-000000000010",
      lessonId: "ae300000-0000-4000-8000-000000000011",
      title: "TCP Review",
      endedAt: "2026-08-25T10:00:00.000Z",
      mssv: "23110001",
      sections: [{
        id: "ae300000-0000-4000-8000-000000000012",
        position: 0,
        type: "QUIZ",
        title: "TCP Quiz",
        contentMd: "",
        quiz: {
          quizId: "ae300000-0000-4000-8000-000000000013",
          title: "TCP Quiz",
          attempt: {
            score: 0,
            totalQuestions: 1,
            submittedAt: "2026-08-25T09:00:00.000Z",
          },
          questions: [{
            id: "ae300000-0000-4000-8000-000000000014",
            position: 0,
            type: "SINGLE_CHOICE",
            questionText: "Server trả lời SYN bằng gì?",
            isCorrect: false,
            options: [
              {
                id: "ae300000-0000-4000-8000-000000000015",
                position: 0,
                content: "ACK",
                isCorrect: false,
                isSelected: true,
              },
              {
                id: "ae300000-0000-4000-8000-000000000016",
                position: 1,
                content: "SYN-ACK",
                isCorrect: true,
                isSelected: false,
              },
            ],
          }],
        },
      }],
    });

    expect(review.sections[0].quiz?.questions[0]).toMatchObject({
      isCorrect: false,
      options: [
        { content: "ACK", isSelected: true, isCorrect: false },
        { content: "SYN-ACK", isSelected: false, isCorrect: true },
      ],
    });
  });

  it("supports a roster Student without an attempt", () => {
    const result = endedLessonReviewSchema.safeParse({
      sessionId: "ae300000-0000-4000-8000-000000000010",
      lessonId: "ae300000-0000-4000-8000-000000000011",
      title: "Review",
      endedAt: "2026-08-25T10:00:00.000Z",
      mssv: "23110002",
      sections: [{
        id: "ae300000-0000-4000-8000-000000000012",
        position: 0,
        type: "CONTENT",
        title: "Content",
        contentMd: "All content",
        quiz: null,
      }],
    });

    expect(result.success).toBe(true);
  });
});
