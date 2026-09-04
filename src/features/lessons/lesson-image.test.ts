import { describe, expect, it } from "vitest";

import {
  createLessonImageMarkdown,
  getLessonImageLabel,
  MAX_LESSON_IMAGE_BYTES,
  validateLessonImageInput,
} from "./lesson-image";
import { parseLessonMarkdown } from "./markdown/parser";

describe("Lesson image helpers", () => {
  it("accepts a supported image with accessible alt text", () => {
    const result = validateLessonImageInput({
      file: new File(["image"], "diagram.png", { type: "image/png" }),
      alt: "  Sơ đồ TCP/IP  ",
    });
    expect(result).toEqual({ ok: true, alt: "Sơ đồ TCP/IP" });
  });

  it("rejects empty alt text, unsupported formats, and oversized images", () => {
    const result = validateLessonImageInput({
      file: new File([new Uint8Array(MAX_LESSON_IMAGE_BYTES + 1)], "diagram.svg", { type: "image/svg+xml" }),
      alt: " ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("Nhập mô tả ảnh.");
      expect(result.errors).toContain("Ảnh không được vượt quá 5 MB.");
      expect(result.errors).toContain("Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.");
    }
  });

  it("rejects a file extension that does not match its MIME type", () => {
    const result = validateLessonImageInput({
      file: new File(["image"], "diagram.jpg", { type: "image/png" }),
      alt: "Sơ đồ",
    });
    expect(result).toEqual({ ok: false, errors: ["Phần mở rộng file không khớp với định dạng ảnh."] });
  });

  it("escapes Markdown control characters in image alt text", () => {
    expect(createLessonImageMarkdown("https://example.com/image.png", "Sơ đồ [TCP]"))
      .toBe("![Sơ đồ \\[TCP\\]](https://example.com/image.png)");
  });

  it("creates a readable label from a generated Storage object name", () => {
    expect(getLessonImageLabel("550e8400-e29b-41d4-a716-446655440000-so-do-tcp-ip.png"))
      .toBe("so do tcp ip");
  });

  it("creates image Markdown accepted by the existing Lesson parser", () => {
    const image = createLessonImageMarkdown("https://cdn.example.com/lesson.png", "Sơ đồ bài học");
    const lesson = parseLessonMarkdown(`---
title: Lesson có ảnh
---

:::section
id: image-section
title: Minh họa
type: content

${image}
:::`);

    expect(lesson.sections[0]).toMatchObject({ type: "CONTENT", contentMd: image });
  });
});
