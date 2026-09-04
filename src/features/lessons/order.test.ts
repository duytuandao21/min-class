import { describe, expect, it } from "vitest";

import { sortLessonsByTitle, sortSessionLessons } from "./order";

describe("Lesson ordering", () => {
  it("sorts numbered Vietnamese Lesson titles naturally", () => {
    const lessons = [
      { id: "3", title: "Bài 10 - Tổng kết" },
      { id: "2", title: "Bài 2 - Mảng động" },
      { id: "1", title: "Bài 1 - Khái niệm" },
    ];

    expect(sortLessonsByTitle(lessons).map((lesson) => lesson.title)).toEqual([
      "Bài 1 - Khái niệm",
      "Bài 2 - Mảng động",
      "Bài 10 - Tổng kết",
    ]);
    expect(lessons[0].title).toBe("Bài 10 - Tổng kết");
  });

  it("uses the same ordering for Session Lesson labels", () => {
    const lessons = [
      { lesson_id: "2", lesson_title: "Lesson 12" },
      { lesson_id: "1", lesson_title: "Lesson 3" },
    ];
    expect(sortSessionLessons(lessons).map((lesson) => lesson.lesson_title)).toEqual(["Lesson 3", "Lesson 12"]);
  });
});
