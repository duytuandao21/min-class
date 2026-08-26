import { describe, expect, it } from "vitest";

import {
  quizSubmissionSchema,
  studentQuizSnapshotSchema,
  teacherQuizAnalyticsSchema,
} from "./quiz";

describe("Quiz MVP contracts", () => {
  it("accepts only question ids and selected option ids for submission", () => {
    const result = quizSubmissionSchema.safeParse([{
      question_id: "71000000-0000-4000-8000-000000000001",
      selected_option_ids: ["81000000-0000-4000-8000-000000000001"],
      score: 100,
    }]);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data[0]).not.toHaveProperty("score");
  });

  it("parses all supported question types without an answer key", () => {
    const snapshot = studentQuizSnapshotSchema.parse({
      quizId: "61000000-0000-4000-8000-000000000001",
      sectionId: "51000000-0000-4000-8000-000000000001",
      title: "Quick check",
      questions: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].map((type, index) => ({
        id: `71000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        position: index,
        type,
        questionText: `Question ${index + 1}`,
        options: [0, 1].map((option) => ({
          id: `81000000-0000-4000-8${index}00-${String(option + 1).padStart(12, "0")}`,
          position: option,
          content: `Option ${option + 1}`,
        })),
      })),
      attempt: null,
    });

    expect(snapshot.questions.map((question) => question.type)).toEqual([
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("correctOption");
  });

  it("accepts answer review only as part of a submitted attempt", () => {
    const snapshot = studentQuizSnapshotSchema.parse({
      quizId: "61000000-0000-4000-8000-000000000001",
      sectionId: "51000000-0000-4000-8000-000000000001",
      title: "Quick check",
      questions: [{
        id: "71000000-0000-4000-8000-000000000001",
        position: 0,
        type: "SINGLE_CHOICE",
        questionText: "Question 1",
        options: [{
          id: "81000000-0000-4000-8000-000000000001",
          position: 0,
          content: "Option 1",
        }, {
          id: "81000000-0000-4000-8000-000000000002",
          position: 1,
          content: "Option 2",
        }],
      }],
      attempt: {
        attemptId: "91000000-0000-4000-8000-000000000001",
        score: 1,
        totalQuestions: 1,
        submittedAt: "2026-08-25T12:00:00.000Z",
        answers: [{
          questionId: "71000000-0000-4000-8000-000000000001",
          selectedOptionIds: ["81000000-0000-4000-8000-000000000001"],
          correctOptionIds: ["81000000-0000-4000-8000-000000000001"],
          isCorrect: true,
        }],
      },
    });

    expect(snapshot.attempt?.answers[0]?.isCorrect).toBe(true);
  });

  it("validates Teacher analytics percentages", () => {
    expect(teacherQuizAnalyticsSchema.safeParse({
      quizzes: [{
        quizId: "61000000-0000-4000-8000-000000000001",
        sectionId: "51000000-0000-4000-8000-000000000001",
        sectionPosition: 1,
        title: "Quick check",
        submittedCount: 2,
        participantCount: 4,
        completionRate: 50,
        averageScore: 2.5,
        totalQuestions: 3,
        questions: [],
      }],
    }).success).toBe(true);
  });
});
