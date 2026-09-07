import { describe, expect, it } from "vitest";

import {
  groupTeacherSummaryByLesson,
  teacherLessonSummarySchema,
  teacherRoomAttendanceDetailSchema,
  teacherRoomSummaryLessonListSchema,
  teacherRoomSummaryOverviewSchema,
} from "./summary";

describe("Teacher Summary Lesson grouping", () => {
  it("validates the lightweight streamed Summary contracts", () => {
    const roomId = "41000000-0000-4000-8000-000000000001";
    const lessonId = "41000000-0000-4000-8000-000000000002";
    const overview = teacherRoomSummaryOverviewSchema.parse({
      room: { id: roomId, title: "Buổi học", startedAt: "2026-09-07T01:00:00Z", endedAt: "2026-09-07T02:00:00Z" },
      attendance: { rosterCount: 45, joinedCount: 42, absentCount: 3 },
      comments: { total: 10, anonymous: 4, named: 6 },
      mostEngagedSection: null,
      lessonContext: {
        lessonId,
        courseSectionId: "41000000-0000-4000-8000-000000000003",
        subjectId: "41000000-0000-4000-8000-000000000004",
      },
    });
    const attendance = teacherRoomAttendanceDetailSchema.parse({
      participants: [{ mssv: "23162011", joinedAt: "2026-09-07T01:05:00Z" }],
      absentMssvs: ["23162012"],
    });
    const lessons = teacherRoomSummaryLessonListSchema.parse([
      { lessonId, lessonTitle: "Lesson 1", sectionCount: 2, quizCount: 1 },
    ]);
    const lesson = teacherLessonSummarySchema.parse({
      lessonId,
      lessonTitle: "Lesson 1",
      reactions: [],
      quizzes: [],
    });

    expect(overview.attendance.joinedCount).toBe(42);
    expect(attendance.absentMssvs).toEqual(["23162012"]);
    expect(lessons[0].quizCount).toBe(1);
    expect(lesson.reactions).toEqual([]);
  });

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
