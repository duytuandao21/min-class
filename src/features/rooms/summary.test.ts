import { describe, expect, it } from "vitest";

import { groupTeacherSummaryByLesson } from "./summary";

describe("Teacher Summary Lesson grouping", () => {
  it("places section reactions and quizzes in their own Lesson", () => {
    const summary = {
      reactions: [
        { sectionId: "51000000-0000-4000-8000-000000000001", sectionPosition: 0, sectionTitle: "A1", understand: 2, unsure: 0, question: 0 },
        { sectionId: "51000000-0000-4000-8000-000000000002", sectionPosition: 0, sectionTitle: "B1", understand: 4, unsure: 1, question: 0 },
      ],
      quizzes: [
        { quizId: "61000000-0000-4000-8000-000000000001", sectionId: "51000000-0000-4000-8000-000000000001", sectionPosition: 1, title: "Quiz A", submittedCount: 2, participantCount: 4, completionRate: 50, averageScore: 1, totalQuestions: 1, questions: [] },
        { quizId: "61000000-0000-4000-8000-000000000002", sectionId: "51000000-0000-4000-8000-000000000002", sectionPosition: 1, title: "Quiz B", submittedCount: 3, participantCount: 4, completionRate: 75, averageScore: 1, totalQuestions: 1, questions: [] },
      ],
    };

    const grouped = groupTeacherSummaryByLesson(summary, [
      { lessonId: "lesson-a", lessonTitle: "Bài 1", sectionIds: ["51000000-0000-4000-8000-000000000001"] },
      { lessonId: "lesson-b", lessonTitle: "Bài 2", sectionIds: ["51000000-0000-4000-8000-000000000002"] },
    ]);

    expect(grouped[0]?.reactions.map((reaction) => reaction.sectionTitle)).toEqual(["A1"]);
    expect(grouped[0]?.quizzes.map((quiz) => quiz.title)).toEqual(["Quiz A"]);
    expect(grouped[1]?.reactions.map((reaction) => reaction.sectionTitle)).toEqual(["B1"]);
    expect(grouped[1]?.quizzes.map((quiz) => quiz.title)).toEqual(["Quiz B"]);
  });
});
