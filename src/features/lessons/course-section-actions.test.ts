import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireTeacher: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/auth/teacher-session", () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  deleteOwnedLessonAction,
  previewCourseSectionLessonAction,
  saveCourseSectionLessonAction,
  saveSubjectTemplateLessonAction,
  updateOwnedLessonAction,
} from "./course-section-actions";

const subjectId = "ae100000-0000-4000-8000-000000000001";
const courseSectionId = "ae200000-0000-4000-8000-000000000001";
const chapterId = "ae250000-0000-4000-8000-000000000001";
const lessonId = "ae300000-0000-4000-8000-000000000001";
const validMarkdown = `---
title: Markdown title
description: Persistent Lesson
---

:::section
id: introduction
title: Introduction
type: content

TCP content.
:::`;

function courseSectionQuery(data: { id: string } | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function lessonForm(markdown = validMarkdown) {
  const formData = new FormData();
  formData.set("lessonTitle", "TCP Introduction");
  formData.set("lessonFile", new File([markdown], "lesson.md", { type: "text/markdown" }));
  return formData;
}

describe("Persistent Course Section Lesson actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTeacher.mockResolvedValue({ id: "teacher", email: "thaybao@minclass.local" });
  });

  it("uploads, parses, and previews a valid Markdown Lesson", async () => {
    const query = courseSectionQuery({ id: courseSectionId });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await previewCourseSectionLessonAction(subjectId, courseSectionId, chapterId, lessonForm());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lesson.title).toBe("TCP Introduction");
      expect(result.lesson.sections).toHaveLength(1);
      expect(result.markdownSource).toBe(validMarkdown);
    }
    expect(query.eq).toHaveBeenCalledWith("id", courseSectionId);
    expect(query.eq).toHaveBeenCalledWith("subject_id", subjectId);
  });

  it("rejects invalid Markdown before showing preview", async () => {
    const query = courseSectionQuery({ id: courseSectionId });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await previewCourseSectionLessonAction(
      subjectId,
      courseSectionId,
      chapterId,
      lessonForm("# Missing frontmatter and section"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it("saves the normalized Lesson into the requested Course Section", async () => {
    const query = courseSectionQuery({ id: courseSectionId });
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        lesson_id: lessonId,
        lesson_title: "TCP Introduction",
        lesson_created_at: "2026-08-25T01:02:03.000Z",
      }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveCourseSectionLessonAction(subjectId, courseSectionId, chapterId, {
      lessonTitle: "TCP Introduction",
      markdownSource: validMarkdown,
    });

    expect(rpc).toHaveBeenCalledWith("create_course_section_lesson", expect.objectContaining({
      p_course_section_id: courseSectionId,
      p_chapter_id: chapterId,
      p_lesson_title: "TCP Introduction",
      p_markdown_source: validMarkdown,
    }));
    expect(result).toEqual({
      ok: true,
      lesson: { id: lessonId, title: "TCP Introduction", createdAt: "2026-08-25T01:02:03.000Z" },
    });
  });

  it("does not create a Lesson for an unavailable Course Section", async () => {
    const query = courseSectionQuery(null);
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveCourseSectionLessonAction(subjectId, courseSectionId, chapterId, {
      lessonTitle: "TCP Introduction",
      markdownSource: validMarkdown,
    });

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates a Subject template Lesson from the normalized Markdown", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ lesson_id: lessonId }], error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const result = await saveSubjectTemplateLessonAction(subjectId, chapterId, {
      lessonTitle: "TCP Introduction",
      markdownSource: validMarkdown,
    });
    expect(result).toEqual({ ok: true, lessonId });
    expect(rpc).toHaveBeenCalledWith("create_subject_template_lesson", expect.objectContaining({
      p_subject_id: subjectId,
      p_chapter_id: chapterId,
      p_lesson_title: "TCP Introduction",
    }));
  });

  it("updates an owned Lesson without trusting client-side parsed content", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: lessonId, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const result = await updateOwnedLessonAction(subjectId, lessonId, chapterId, {
      lessonTitle: "TCP Introduction",
      markdownSource: validMarkdown,
    });
    expect(result).toEqual({ ok: true, lessonId });
    expect(rpc).toHaveBeenCalledWith("update_owned_lesson", expect.objectContaining({ p_lesson_id: lessonId }));
  });

  it("deletes an owned Lesson even when its Sessions are cascaded by the RPC", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: lessonId, error: null }),
    });
    const result = await deleteOwnedLessonAction(subjectId, courseSectionId, lessonId);
    expect(result).toEqual({ ok: true, lessonId });
  });
});
