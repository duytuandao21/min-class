import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MarkdownValidationError, parseLessonMarkdown } from "./parser";

const validLesson = `---
title: TCP Three-Way Handshake
description: Nắm được ba bước thiết lập kết nối TCP.
---

:::section
id: tcp-overview
title: TCP là gì?
type: content

## Tổng quan

TCP là giao thức **tin cậy** với *kết nối* [tham khảo](https://example.com).

- SYN
- ACK

![TCP diagram](https://example.com/tcp.png)

Dùng \`SYN\` trước:

\`\`\`text
SYN -> SYN-ACK -> ACK
\`\`\`
:::

:::quiz
id: handshake-check
title: Quick Check
question:
  type: single
  text: Gói tin nào hoàn tất handshake?
options:
  - text: SYN
    correct: false
  - text: ACK
    correct: true
:::`;

describe("parseLessonMarkdown", () => {
  it("parses the complete manual test lesson", () => {
    const source = readFileSync(resolve(process.cwd(), "test/lesson.md"), "utf8");
    const lesson = parseLessonMarkdown(source);
    const quiz = lesson.sections.at(-1);

    expect(lesson.sections).toHaveLength(8);
    expect(lesson.sections.some((section) => section.type === "REFLECTION")).toBe(true);
    expect(lesson.sections.some((section) => section.contentMd.includes("![Minh họa"))).toBe(true);
    expect(quiz?.type).toBe("QUIZ");
    if (quiz?.type === "QUIZ") {
      expect(quiz.quiz.questions).toHaveLength(8);
      expect(new Set(quiz.quiz.questions.map((question) => question.type))).toEqual(
        new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
      );
    }
  });

  it("returns normalized content and quiz data", () => {
    const lesson = parseLessonMarkdown(validLesson);

    expect(lesson).toMatchObject({
      title: "TCP Three-Way Handshake",
      description: "Nắm được ba bước thiết lập kết nối TCP.",
      sections: [
        { id: "tcp-overview", position: 0, type: "CONTENT", title: "TCP là gì?" },
        { id: "handshake-check", position: 1, type: "QUIZ", title: "Quick Check" },
      ],
    });
    const quiz = lesson.sections[1];
    expect(quiz.type).toBe("QUIZ");
    if (quiz.type === "QUIZ") {
      expect(quiz.quiz.questions[0]).toMatchObject({
        id: "handshake-check-question-1",
        type: "SINGLE_CHOICE",
        questionText: "Gói tin nào hoàn tất handshake?",
      });
      expect(quiz.quiz.questions[0].options).toEqual([
        { id: "option-1", position: 0, content: "SYN", isCorrect: false },
        { id: "option-2", position: 1, content: "ACK", isCorrect: true },
      ]);
    }
  });

  it("rejects duplicate section ids after normalization", () => {
    const duplicate = `${validLesson}\n\n:::section\nid: TCP-OVERVIEW\ntitle: Duplicate\n\nDuplicate body.\n:::`;

    expect(() => parseLessonMarkdown(duplicate)).toThrowError(/section id bị trùng/);
  });

  it.each([
    ["raw HTML", validLesson.replace("## Tổng quan", "<script>alert('xss')</script>")],
    ["unsafe link", validLesson.replace("https://example.com", "javascript:alert(1)")],
    ["missing correct answer", validLesson.replace("correct: true", "correct: false")],
    ["missing frontmatter", validLesson.replace(/^---/, "")],
    ["unsupported top-level content", validLesson.replace(":::section", "Nội dung ngoài directive\n\n:::section")],
  ])("rejects invalid input: %s", (_label, markdown) => {
    expect(() => parseLessonMarkdown(markdown)).toThrow(MarkdownValidationError);
  });

  it("validates multiple-choice and true/false rules", () => {
    const lesson = validLesson.replace(
      /:::quiz[\s\S]*$/,
      `:::quiz
id: checks
title: Checks
questions:
  - id: multiple-check
    type: multiple
    text: Chọn hai đáp án đúng.
    options:
      - text: A
        correct: true
      - text: B
        correct: true
  - id: boolean-check
    type: true_false
    text: TCP là connection-oriented?
    options:
      - text: Đúng
        correct: true
      - text: Sai
        correct: false
:::`,
    );

    const parsed = parseLessonMarkdown(lesson);
    const quiz = parsed.sections[1];
    expect(quiz.type).toBe("QUIZ");
    if (quiz.type === "QUIZ") {
      expect(quiz.quiz.questions.map((question) => question.type)).toEqual([
        "MULTIPLE_CHOICE",
        "TRUE_FALSE",
      ]);
    }
  });
});
