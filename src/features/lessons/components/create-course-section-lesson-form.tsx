"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  previewCourseSectionLessonAction,
  previewLessonMarkdownAction,
  saveCourseSectionLessonAction,
  type CourseSectionLessonPreviewResult,
} from "@/features/lessons/course-section-actions";
import { LessonImageUploader } from "@/features/lessons/components/lesson-image-uploader";
import { MarkdownPreview } from "@/features/lessons/components/markdown-preview";
import { LessonModeSwitch, type LessonEditorMode } from "@/features/lessons/components/lesson-mode-switch";
import type { Chapter } from "@/features/subjects/server/queries";

type Preview = Extract<CourseSectionLessonPreviewResult, { ok: true }>;
export function CreateCourseSectionLessonForm({ chapter, subjectId, courseSectionId }: { chapter: Chapter; subjectId: string; courseSectionId: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<LessonEditorMode>("preview");
  const [lessonTitle, setLessonTitle] = useState("");
  const [markdownSource, setMarkdownSource] = useState("");
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
      setLessonTitle(result.lessonTitle);
      setMarkdownSource(result.markdownSource);
      setPreview(result);
      setMode("preview");
    });
  }

  function switchMode(nextMode: LessonEditorMode) {
    if (nextMode === "edit") {
      setMode("edit");
      return;
    }
    setErrors([]);
    startPreview(async () => {
      const result = await previewLessonMarkdownAction({ lessonTitle, markdownSource });
      if (!result.ok) {
        setPreview(null);
        setErrors(result.errors);
        return;
      }
      setPreview(result);
      setMode("preview");
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
      router.push(`/teacher/subjects/${subjectId}/sections/${courseSectionId}`);
      router.refresh();
    });
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
          onChange={(event) => {
            setLessonTitle(event.target.value);
            invalidatePreview();
          }}
          placeholder="Ví dụ: TCP Introduction"
          required
        />
        <label className="mt-5 block text-sm font-semibold" htmlFor="lessonFile">Lesson Markdown</label>
        <input
          accept=".md,text/markdown,text/plain"
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900/8 file:px-3 file:py-2 file:font-semibold file:text-[var(--accent)]"
          id="lessonFile"
          name="lessonFile"
          onChange={() => {
            setMarkdownSource("");
            invalidatePreview();
          }}
          required
          type="file"
        />
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">File .md, tối đa 1 MB. Phải preview trước khi lưu.</p>
        <LessonImageUploader disabled={isPreviewing || isSaving} subjectId={subjectId} />

        {errors.length > 0 ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p className="font-semibold">Không thể tiếp tục:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        ) : null}

        {!markdownSource ? (
          <button
            className="mt-6 w-full rounded-xl bg-[#17201b] px-4 py-3 font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPreviewing || isSaving}
            type="submit"
          >
            {isPreviewing ? "Đang parse…" : "Đọc file & Preview"}
          </button>
        ) : null}
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

      <div className="min-w-0">
        {markdownSource ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[var(--muted)]">Chỉnh sửa source hoặc xem kết quả hiển thị</p>
              <LessonModeSwitch disabled={isPreviewing || isSaving} mode={mode} onChange={switchMode} />
            </div>
            {mode === "edit" ? (
              <textarea
                aria-label="Nội dung Markdown của Lesson"
                autoFocus
                className="min-h-[38rem] w-full resize-y rounded-3xl border border-black/15 bg-[#17201b] p-6 font-mono text-sm leading-7 text-slate-100 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-700/15"
                onChange={(event) => {
                  setMarkdownSource(event.target.value);
                  invalidatePreview();
                }}
                spellCheck={false}
                value={markdownSource}
              />
            ) : preview ? (
              <MarkdownPreview lesson={preview.lesson} />
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-black/20 px-8 text-center text-sm text-[var(--muted)]">
                {isPreviewing ? "Đang cập nhật Preview…" : "Chuyển lại Preview mode để kiểm tra nội dung vừa chỉnh sửa."}
              </div>
            )}
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
