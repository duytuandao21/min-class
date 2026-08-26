"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  previewCourseSectionLessonAction,
  saveCourseSectionLessonAction,
  type CourseSectionLessonPreviewResult,
  type SaveCourseSectionLessonResult,
} from "@/features/lessons/course-section-actions";
import { MarkdownPreview } from "@/features/lessons/components/markdown-preview";
import type { Chapter } from "@/features/subjects/server/queries";

type Preview = Extract<CourseSectionLessonPreviewResult, { ok: true }>;
type CreatedLesson = Extract<SaveCourseSectionLessonResult, { ok: true }>["lesson"];

export function CreateCourseSectionLessonForm({ chapter, subjectId, courseSectionId }: { chapter: Chapter; subjectId: string; courseSectionId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [createdLesson, setCreatedLesson] = useState<CreatedLesson | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPreviewing, startPreview] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function invalidatePreview() {
    setPreview(null);
    setErrors([]);
  }

  function handlePreview(formData: FormData) {
    setErrors([]);
    startPreview(async () => {
      const result = await previewCourseSectionLessonAction(subjectId, courseSectionId, chapter.id, formData);
      if (!result.ok) {
        setPreview(null);
        setErrors(result.errors);
        return;
      }
      setPreview(result);
    });
  }

  function handleSave() {
    if (!preview) return;
    setErrors([]);
    startSaving(async () => {
      const result = await saveCourseSectionLessonAction(subjectId, courseSectionId, chapter.id, {
        lessonTitle: preview.lessonTitle,
        markdownSource: preview.markdownSource,
      });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setCreatedLesson(result.lesson);
    });
  }

  if (createdLesson) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 shadow-sm sm:p-10">
        <p className="text-sm font-bold tracking-[0.16em] text-[var(--accent)]">LESSON ĐÃ LƯU</p>
        <h2 className="mt-3 text-3xl font-semibold">{createdLesson.title}</h2>
        <p className="mt-4 text-emerald-900">Lesson đang ở thư viện Course Section và chưa LIVE.</p>
        <Link
          className="mt-7 inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-emerald-800"
          href={`/teacher/subjects/${subjectId}/sections/${courseSectionId}`}
        >
          Quay về Course Section
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <form
        className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm lg:sticky lg:top-8"
        onSubmit={(event) => {
          event.preventDefault();
          handlePreview(new FormData(event.currentTarget));
        }}
      >
        <p className="mb-6 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
          {chapter.name}
        </p>
        <label className="text-sm font-semibold" htmlFor="lessonTitle">Tên Lesson</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-emerald-700/15"
          id="lessonTitle"
          maxLength={200}
          name="lessonTitle"
          onChange={invalidatePreview}
          placeholder="Ví dụ: TCP Introduction"
          required
        />
        <label className="mt-5 block text-sm font-semibold" htmlFor="lessonFile">Lesson Markdown</label>
        <input
          accept=".md,text/markdown,text/plain"
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900/8 file:px-3 file:py-2 file:font-semibold file:text-[var(--accent)]"
          id="lessonFile"
          name="lessonFile"
          onChange={invalidatePreview}
          required
          type="file"
        />
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">File .md, tối đa 1 MB. Phải preview trước khi lưu.</p>

        {errors.length > 0 ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p className="font-semibold">Không thể tiếp tục:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        ) : null}

        <button
          className="mt-6 w-full rounded-xl bg-[#17201b] px-4 py-3 font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPreviewing || isSaving}
          type="submit"
        >
          {isPreviewing ? "Đang parse…" : preview ? "Preview lại" : "Parse & Preview"}
        </button>
        {preview ? (
          <button
            className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || isPreviewing}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Đang lưu…" : "Lưu Lesson"}
          </button>
        ) : null}
      </form>

      <div>
        {preview ? (
          <>
            <p className="mb-4 text-sm text-[var(--muted)]">Preview từ <span className="font-medium text-[var(--foreground)]">{preview.fileName}</span></p>
            <MarkdownPreview lesson={preview.lesson} />
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-black/20 px-8 text-center text-sm leading-6 text-[var(--muted)]">
            Preview Lesson sẽ xuất hiện ở đây sau khi Markdown được parse và validate.
          </div>
        )}
      </div>
    </div>
  );
}
