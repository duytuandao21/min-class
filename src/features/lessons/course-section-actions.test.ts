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
  prepareCourseSectionLessonsAction,
  prepareSubjectTemplateLessonsAction,
  previewCourseSectionLessonAction,
  saveCourseSectionLessonsBatchAction,
  saveCourseSectionLessonAction,
  saveSubjectTemplateLessonsBatchAction,
  saveSubjectTemplateLessonAction,
  updateSubjectTemplateLessonAction,
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

function lessonBatchForm(files: Array<{ name: string; markdown: string }>) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("lessonFiles", new File([file.markdown], file.name, { type: "text/markdown" }));
  }
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

  it("prepares multiple Markdown files and preserves their independent previews", async () => {
    const query = courseSectionQuery({ id: courseSectionId });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });
    const secondMarkdown = validMarkdown
      .replace("Markdown title", "Second Lesson")
      .replace("id: introduction", "id: second-section");

    const result = await prepareCourseSectionLessonsAction(
      subjectId,
      courseSectionId,
      chapterId,
      lessonBatchForm([
        { name: "lesson-one.md", markdown: validMarkdown },
        { name: "lesson-two.md", markdown: secondMarkdown },
      ]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lessons).toHaveLength(2);
      expect(result.lessons.map((lesson) => lesson.lessonTitle)).toEqual(["Markdown title", "Second Lesson"]);
      expect(result.lessons.every((lesson) => lesson.lesson?.sections.length === 1)).toBe(true);
    }
  });

  it("keeps an invalid file in the prepared list so the Teacher can edit it", async () => {
    const query = courseSectionQuery({ id: courseSectionId });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await prepareCourseSectionLessonsAction(
      subjectId,
      courseSectionId,
      chapterId,
      lessonBatchForm([{ name: "needs-fixing.md", markdown: "# Missing frontmatter" }]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lessons[0]).toMatchObject({
        fileName: "needs-fixing.md",
        lessonTitle: "needs-fixing",
        markdownSource: "# Missing frontmatter",
        lesson: null,
      });
      expect(result.lessons[0].errors.length).toBeGreaterThan(0);
    }
  });

  it("prepares multiple Subject template Lesson files for the selected Chapter", async () => {
    const query = courseSectionQuery({ id: chapterId });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });
    const secondMarkdown = validMarkdown
      .replace("Markdown title", "Template Two")
      .replace("id: introduction", "id: template-two");

    const result = await prepareSubjectTemplateLessonsAction(
      subjectId,
      chapterId,
      lessonBatchForm([
        { name: "template-one.md", markdown: validMarkdown },
        { name: "template-two.md", markdown: secondMarkdown },
      ]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lessons.map((lesson) => lesson.lessonTitle)).toEqual(["Markdown title", "Template Two"]);
    expect(query.eq).toHaveBeenCalledWith("subject_id", subjectId);
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

  it("saves multiple Lessons through one atomic batch RPC", async () => {
    const query = courseSectionQuery({ id: courseSectionId });
    const secondLessonId = "ae300000-0000-4000-8000-000000000002";
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { lessonId, lessonTitle: "Lesson One", lessonCreatedAt: "2026-09-07T01:02:03.000Z" },
        { lessonId: secondLessonId, lessonTitle: "Lesson Two", lessonCreatedAt: "2026-09-07T01:02:04.000Z" },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveCourseSectionLessonsBatchAction(subjectId, courseSectionId, chapterId, [
      { lessonTitle: "Lesson One", markdownSource: validMarkdown },
      { lessonTitle: "Lesson Two", markdownSource: validMarkdown },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lessons.map((lesson) => lesson.title)).toEqual(["Lesson One", "Lesson Two"]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("create_course_section_lessons_batch", expect.objectContaining({
      p_course_section_id: courseSectionId,
      p_chapter_id: chapterId,
      p_lessons: expect.arrayContaining([
        expect.objectContaining({ lessonTitle: "Lesson One", markdownSource: validMarkdown }),
        expect.objectContaining({ lessonTitle: "Lesson Two", markdownSource: validMarkdown }),
      ]),
    }));
  });

  it("rejects duplicate Lesson titles before calling the batch RPC", async () => {
    const query = courseSectionQuery({ id: courseSectionId });
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveCourseSectionLessonsBatchAction(subjectId, courseSectionId, chapterId, [
      { lessonTitle: "TCP Basics", markdownSource: validMarkdown },
      { lessonTitle: " tcp basics ", markdownSource: validMarkdown },
    ]);

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves Subject template Lessons in one batch while preserving the sync choice", async () => {
    const query = courseSectionQuery({ id: chapterId });
    const secondLessonId = "ae300000-0000-4000-8000-000000000002";
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { lessonId, appliedCount: 0, skippedCount: 0 },
        { lessonId: secondLessonId, appliedCount: 0, skippedCount: 0 },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveSubjectTemplateLessonsBatchAction(subjectId, chapterId, [
      { lessonTitle: "Template One", markdownSource: validMarkdown },
      { lessonTitle: "Template Two", markdownSource: validMarkdown },
    ], false);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lessons).toHaveLength(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("create_subject_template_lessons_batch", expect.objectContaining({
      p_subject_id: subjectId,
      p_chapter_id: chapterId,
      p_apply_to_existing: false,
      p_lessons: expect.arrayContaining([
        expect.objectContaining({ lessonTitle: "Template One" }),
        expect.objectContaining({ lessonTitle: "Template Two" }),
      ]),
    }));
  });

  it("does not batch-create template Lessons in a Chapter the Teacher cannot access", async () => {
    const query = courseSectionQuery(null);
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query), rpc });

    const result = await saveSubjectTemplateLessonsBatchAction(subjectId, chapterId, [
      { lessonTitle: "Template One", markdownSource: validMarkdown },
    ]);

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
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
    const rpc = vi.fn().mockResolvedValue({ data: { lessonId, appliedCount: 2, skippedCount: 0 }, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const result = await saveSubjectTemplateLessonAction(subjectId, chapterId, {
      lessonTitle: "TCP Introduction",
      markdownSource: validMarkdown,
    });
    expect(result).toEqual({ ok: true, lessonId, appliedCount: 2, skippedCount: 0 });
    expect(rpc).toHaveBeenCalledWith("create_subject_template_lesson_synced", expect.objectContaining({
      p_subject_id: subjectId,
      p_chapter_id: chapterId,
      p_lesson_title: "TCP Introduction",
      p_apply_to_existing: true,
    }));
  });

  it("updates a template Lesson without applying when Teacher opts out", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { lessonId, appliedCount: 0, skippedCount: 0 }, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const result = await updateSubjectTemplateLessonAction(subjectId, lessonId, chapterId, {
      lessonTitle: "TCP Introduction",
      markdownSource: validMarkdown,
    }, false);
    expect(result).toEqual({ ok: true, lessonId, appliedCount: 0, skippedCount: 0 });
    expect(rpc).toHaveBeenCalledWith("update_subject_template_lesson_synced", expect.objectContaining({
      p_lesson_id: lessonId,
      p_apply_to_existing: false,
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
