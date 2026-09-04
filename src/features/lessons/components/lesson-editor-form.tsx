"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  previewLessonMarkdownAction,
  saveSubjectTemplateLessonAction,
  updateOwnedLessonAction,
  type CourseSectionLessonPreviewResult,
} from "@/features/lessons/course-section-actions";
import { LessonImageUploader } from "@/features/lessons/components/lesson-image-uploader";
import { MarkdownPreview } from "@/features/lessons/components/markdown-preview";
import { LessonModeSwitch, type LessonEditorMode } from "@/features/lessons/components/lesson-mode-switch";
import type { Chapter } from "@/features/subjects/server/queries";

type Preview = Extract<CourseSectionLessonPreviewResult, { ok: true }>;

type LessonEditorFormProps = {
  chapters: Chapter[];
  initial?: { id: string; chapterId: string; title: string; markdownSource: string };
  mode: "create-template" | "edit";
  returnHref: string;
  subjectId: string;
};

export function LessonEditorForm({ chapters, initial, mode, returnHref, subjectId }: LessonEditorFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [chapterId, setChapterId] = useState(initial?.chapterId ?? chapters[0]?.id ?? "");
  const [markdownSource, setMarkdownSource] = useState(initial?.markdownSource ?? "");
  const [displayMode, setDisplayMode] = useState<LessonEditorMode>("edit");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function invalidate() {
    setPreview(null);
    setErrors([]);
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".md")) {
      setErrors(["Chỉ chấp nhận file .md."]);
      return;
    }
    if (file.size > 1024 * 1024) {
      setErrors(["File Markdown không được vượt quá 1 MB."]);
      return;
    }
    setMarkdownSource(await file.text());
    invalidate();
    setDisplayMode("edit");
  }

  function handlePreview() {
    startTransition(async () => {
      const result = await previewLessonMarkdownAction({ lessonTitle: title, markdownSource });
      if (!result.ok) {
        setPreview(null);
        setErrors(result.errors);
        return;
      }
      setErrors([]);
      setPreview(result);
      setDisplayMode("preview");
    });
  }

  function switchDisplayMode(nextMode: LessonEditorMode) {
    if (nextMode === "edit") {
      setDisplayMode("edit");
      return;
    }
    handlePreview();
  }

  function handleSave() {
    if (!markdownSource.trim()) return;
    startTransition(async () => {
      setErrors([]);
      const input = { lessonTitle: title, markdownSource };
      const result = mode === "create-template"
        ? await saveSubjectTemplateLessonAction(subjectId, chapterId, input)
        : await updateOwnedLessonAction(subjectId, initial?.id ?? "", chapterId, input);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.push(returnHref);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.35fr)] lg:items-start">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm lg:sticky lg:top-6">
        <label className="text-sm font-bold" htmlFor="lesson-chapter">Chương</label>
        <select
          className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3"
          id="lesson-chapter"
          onChange={(event) => { setChapterId(event.target.value); invalidate(); }}
          value={chapterId}
        >
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}
        </select>

        <label className="mt-5 block text-sm font-bold" htmlFor="lesson-title">Tên Lesson</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3"
          id="lesson-title"
          maxLength={200}
          onChange={(event) => { setTitle(event.target.value); invalidate(); }}
          value={title}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold">File Markdown</p>
          <button
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            Upload file .md mới
          </button>
          <input
            accept=".md,text/markdown,text/plain"
            className="sr-only"
            id="lesson-file"
            onChange={(event) => void loadFile(event.target.files?.[0])}
            ref={fileRef}
            type="file"
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Upload file hiện tại hoặc chỉnh sửa trực tiếp source ở Edit mode.</p>
        <LessonImageUploader disabled={pending} subjectId={subjectId} />

        {errors.length > 0 ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <ul className="list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        ) : null}

        {markdownSource.trim() ? (
          <button className="mt-5 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={pending} onClick={handleSave} type="button">
            {pending ? "Đang lưu…" : mode === "create-template" ? "Lưu Lesson mẫu" : "Lưu thay đổi"}
          </button>
        ) : null}
      </section>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[var(--muted)]">Nội dung Lesson</p>
          <LessonModeSwitch disabled={pending || markdownSource.length === 0} mode={displayMode} onChange={switchDisplayMode} />
        </div>
        {displayMode === "edit" ? (
          <textarea
            aria-label="Nội dung Markdown của Lesson"
            className="min-h-[38rem] w-full resize-y rounded-3xl border border-black/15 bg-[#17201b] p-6 font-mono text-sm leading-7 text-slate-100 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-700/15"
            id="lesson-markdown"
            onChange={(event) => { setMarkdownSource(event.target.value); invalidate(); }}
            placeholder="Upload file .md hoặc nhập nội dung Lesson tại đây."
            spellCheck={false}
            value={markdownSource}
          />
        ) : preview ? (
          <MarkdownPreview lesson={preview.lesson} />
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-3xl border border-dashed border-black/20 bg-white px-8 text-center text-[var(--muted)]">
            {pending ? "Đang cập nhật Preview…" : "Chọn Preview mode để kiểm tra nội dung mới nhất trước khi lưu."}
          </div>
        )}
      </div>
    </div>
  );
}
