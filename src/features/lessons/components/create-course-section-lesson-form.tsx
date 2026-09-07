"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  prepareCourseSectionLessonsAction,
  prepareSubjectTemplateLessonsAction,
  previewLessonMarkdownAction,
  saveCourseSectionLessonsBatchAction,
  saveSubjectTemplateLessonsBatchAction,
  type PreparedCourseSectionLesson,
} from "@/features/lessons/course-section-actions";
import { LessonImageUploader } from "@/features/lessons/components/lesson-image-uploader";
import { MarkdownPreview } from "@/features/lessons/components/markdown-preview";
import { LessonModeSwitch, type LessonEditorMode } from "@/features/lessons/components/lesson-mode-switch";
import type { NormalizedLesson } from "@/features/lessons/markdown/schema";
import type { Chapter } from "@/features/subjects/server/queries";
import { TemplateSyncChoice } from "@/features/subjects/components/template-sync-choice";

const MAX_BATCH_LESSONS = 20;

type LessonDraft = {
  id: string;
  fileName: string;
  lessonTitle: string;
  markdownSource: string;
  lesson: NormalizedLesson | null;
  errors: string[];
};

function createDraft(item: PreparedCourseSectionLesson, index: number): LessonDraft {
  return { ...item, id: `${crypto.randomUUID()}-${index}` };
}

function getDuplicateTitleIds(drafts: LessonDraft[]): Set<string> {
  const idsByTitle = new Map<string, string[]>();
  for (const draft of drafts) {
    const key = draft.lessonTitle.trim().toLocaleLowerCase("vi");
    if (!key) continue;
    idsByTitle.set(key, [...(idsByTitle.get(key) ?? []), draft.id]);
  }
  return new Set([...idsByTitle.values()].filter((ids) => ids.length > 1).flat());
}

type LessonBatchFormProps = {
  chapter: Chapter;
  subjectId: string;
} & (
  | { kind: "course"; courseSectionId: string }
  | { kind: "template"; courseSectionCount: number }
);

function LessonBatchForm(props: LessonBatchFormProps) {
  const { chapter, subjectId } = props;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<LessonDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<LessonEditorMode>("preview");
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [isPreparing, startPreparing] = useTransition();
  const [isPreviewing, startPreviewing] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const selectedDraft = drafts.find((draft) => draft.id === selectedId) ?? null;
  const duplicateTitleIds = useMemo(() => getDuplicateTitleIds(drafts), [drafts]);
  const validCount = drafts.filter((draft) => draft.lesson && draft.errors.length === 0).length;
  const isBusy = isPreparing || isPreviewing || isSaving;
  const canSave = drafts.length > 0
    && drafts.every((draft) => draft.lesson && draft.errors.length === 0 && draft.lessonTitle.trim() && draft.markdownSource.trim())
    && duplicateTitleIds.size === 0
    && !isBusy;

  function updateDraft(id: string, update: Partial<LessonDraft>) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...update } : draft));
  }

  function handleFiles(formData: FormData) {
    setGlobalErrors([]);
    const incomingCount = formData.getAll("lessonFiles").length;
    if (drafts.length + incomingCount > MAX_BATCH_LESSONS) {
      setGlobalErrors([`Mỗi lần chỉ được thêm tối đa ${MAX_BATCH_LESSONS} Lesson.`]);
      return;
    }
    startPreparing(async () => {
      const result = props.kind === "course"
        ? await prepareCourseSectionLessonsAction(subjectId, props.courseSectionId, chapter.id, formData)
        : await prepareSubjectTemplateLessonsAction(subjectId, chapter.id, formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!result.ok) {
        setGlobalErrors(result.errors);
        return;
      }
      const newDrafts = result.lessons.map(createDraft);
      setDrafts((current) => [...current, ...newDrafts]);
      if (newDrafts[0]) {
        setSelectedId(newDrafts[0].id);
        setMode(newDrafts[0].lesson ? "preview" : "edit");
      }
    });
  }

  function removeDraft(id: string) {
    const removedIndex = drafts.findIndex((draft) => draft.id === id);
    const remaining = drafts.filter((draft) => draft.id !== id);
    setDrafts(remaining);
    if (selectedId === id) {
      setSelectedId(remaining[Math.min(removedIndex, remaining.length - 1)]?.id ?? null);
      setMode("preview");
    }
    setGlobalErrors([]);
  }

  function switchMode(nextMode: LessonEditorMode) {
    if (!selectedDraft || nextMode === mode) return;
    if (nextMode === "edit") {
      setMode("edit");
      return;
    }
    setGlobalErrors([]);
    startPreviewing(async () => {
      const result = await previewLessonMarkdownAction({
        lessonTitle: selectedDraft.lessonTitle,
        markdownSource: selectedDraft.markdownSource,
      });
      if (!result.ok) {
        updateDraft(selectedDraft.id, { lesson: null, errors: result.errors });
        return;
      }
      updateDraft(selectedDraft.id, { lesson: result.lesson, errors: [] });
      setMode("preview");
    });
  }

  function handleSave() {
    if (!canSave) return;
    setGlobalErrors([]);
    startSaving(async () => {
      const input = drafts.map((draft) => ({ lessonTitle: draft.lessonTitle, markdownSource: draft.markdownSource }));
      const result = props.kind === "course"
        ? await saveCourseSectionLessonsBatchAction(subjectId, props.courseSectionId, chapter.id, input)
        : await saveSubjectTemplateLessonsBatchAction(subjectId, chapter.id, input, applyToExisting);
      if (!result.ok) {
        setGlobalErrors(result.errors);
        return;
      }
      router.push(props.kind === "course"
        ? `/teacher/subjects/${subjectId}/sections/${props.courseSectionId}`
        : `/teacher/subjects/${subjectId}?lessonPlan=open`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-7">
      <form
        className="rounded-3xl border border-emerald-200 bg-emerald-50/45 p-5 shadow-sm sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          handleFiles(new FormData(event.currentTarget));
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Thêm các file Lesson</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Chọn tối đa {MAX_BATCH_LESSONS} file .md. Mỗi file sẽ tạo thành một {props.kind === "template" ? "Lesson mẫu" : "Lesson"} trong <strong>{chapter.name}</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              accept=".md,text/markdown,text/plain"
              className="max-w-72 text-sm file:mr-3 file:rounded-xl file:border file:border-emerald-200 file:bg-white file:px-4 file:py-2.5 file:font-bold file:text-[var(--accent)] hover:file:bg-emerald-50"
              disabled={isBusy || drafts.length >= MAX_BATCH_LESSONS}
              id="lessonFiles"
              multiple
              name="lessonFiles"
              ref={fileInputRef}
              required
              type="file"
            />
            <button
              className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              disabled={isBusy || drafts.length >= MAX_BATCH_LESSONS}
              type="submit"
            >
              {isPreparing ? "Đang đọc file…" : "Thêm vào danh sách"}
            </button>
          </div>
        </div>
      </form>

      {drafts.length > 0 ? (
        <section aria-label="Danh sách Lesson đang chuẩn bị" className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="font-bold">{drafts.length} Lesson · {validCount} đã sẵn sàng</p>
            {duplicateTitleIds.size > 0 ? <p className="text-sm font-semibold text-red-700">Có tên Lesson bị trùng.</p> : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {drafts.map((draft) => {
              const selected = draft.id === selectedId;
              const hasDuplicateTitle = duplicateTitleIds.has(draft.id);
              const status = hasDuplicateTitle || draft.errors.length > 0 ? "error" : draft.lesson ? "ready" : "pending";
              return (
                <button
                  aria-pressed={selected}
                  className={`group inline-flex min-w-44 shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition disabled:cursor-wait disabled:opacity-70 ${selected ? "border-emerald-600 bg-emerald-700 text-white shadow-sm" : "border-black/10 bg-white hover:border-emerald-300 hover:bg-emerald-50"}`}
                  disabled={isBusy}
                  key={draft.id}
                  onClick={() => {
                    setSelectedId(draft.id);
                    setMode(draft.lesson ? "preview" : "edit");
                    setGlobalErrors([]);
                  }}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{draft.lessonTitle || draft.fileName}</span>
                    <span className={`mt-0.5 block truncate text-xs ${selected ? "text-emerald-50" : "text-[var(--muted)]"}`}>{draft.fileName}</span>
                  </span>
                  <span
                    aria-label={status === "ready" ? "Hợp lệ" : status === "error" ? "Có lỗi" : "Cần preview"}
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${status === "ready" ? "bg-emerald-300" : status === "error" ? "bg-red-400" : "bg-amber-400"}`}
                    title={status === "ready" ? "Hợp lệ" : status === "error" ? "Có lỗi" : "Cần preview"}
                  />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {globalErrors.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          <p className="font-semibold">Không thể tiếp tục:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{globalErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}

      {selectedDraft ? (
        <div className="grid gap-7 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm lg:sticky lg:top-8">
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent)]">LESSON ĐANG CHỌN</p>
            <label className="mt-5 block text-sm font-semibold" htmlFor={`lesson-title-${selectedDraft.id}`}>Tên bài học</label>
            <input
              className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-emerald-700/15"
              id={`lesson-title-${selectedDraft.id}`}
              maxLength={200}
              onChange={(event) => updateDraft(selectedDraft.id, { lessonTitle: event.target.value, lesson: null, errors: [] })}
              value={selectedDraft.lessonTitle}
            />
            <p className="mt-2 truncate text-xs text-[var(--muted)]" title={selectedDraft.fileName}>File: {selectedDraft.fileName}</p>

            <button
              className="mt-5 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              disabled={isBusy}
              onClick={() => removeDraft(selectedDraft.id)}
              type="button"
            >
              Xóa file khỏi danh sách
            </button>

            <LessonImageUploader disabled={isBusy} subjectId={subjectId} />

            {props.kind === "template" ? (
              <TemplateSyncChoice
                checked={applyToExisting}
                courseSectionCount={props.courseSectionCount}
                onChange={setApplyToExisting}
              />
            ) : null}

            {selectedDraft.errors.length > 0 || duplicateTitleIds.has(selectedDraft.id) ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
                <p className="font-semibold">Lesson này cần kiểm tra:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {duplicateTitleIds.has(selectedDraft.id) ? <li>Tên Lesson bị trùng trong danh sách.</li> : null}
                  {selectedDraft.errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            ) : null}

            <button
              className="mt-6 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSave}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? "Đang lưu…" : `Lưu ${drafts.length} ${props.kind === "template" ? "Lesson mẫu" : "Lesson"}`}
            </button>
            {!canSave && drafts.length > 0 && !isBusy ? (
              <p className="mt-2 text-center text-xs leading-5 text-[var(--muted)]">Hãy Preview và sửa hết lỗi của từng Lesson trước khi lưu.</p>
            ) : null}
          </aside>

          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[var(--muted)]">Chỉnh sửa source hoặc xem kết quả hiển thị</p>
              <LessonModeSwitch disabled={isBusy} mode={mode} onChange={switchMode} />
            </div>
            {mode === "edit" ? (
              <textarea
                aria-label={`Nội dung Markdown của ${selectedDraft.lessonTitle || selectedDraft.fileName}`}
                className="min-h-[38rem] w-full resize-y rounded-3xl border border-black/15 bg-[#17201b] p-6 font-mono text-sm leading-7 text-slate-100 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-700/15"
                onChange={(event) => updateDraft(selectedDraft.id, { markdownSource: event.target.value, lesson: null, errors: [] })}
                spellCheck={false}
                value={selectedDraft.markdownSource}
              />
            ) : selectedDraft.lesson ? (
              <MarkdownPreview lesson={selectedDraft.lesson} />
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-black/20 px-8 text-center text-sm text-[var(--muted)]">
                {isPreviewing ? "Đang cập nhật Preview…" : "Chuyển sang Preview mode để kiểm tra nội dung vừa chỉnh sửa."}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-72 items-center justify-center rounded-3xl border border-dashed border-black/20 bg-white/60 px-8 text-center text-sm leading-6 text-[var(--muted)]">
          Chọn một hoặc nhiều file Markdown để bắt đầu. Danh sách Lesson và Preview sẽ xuất hiện tại đây.
        </div>
      )}
    </div>
  );
}

export function CreateCourseSectionLessonForm({ chapter, subjectId, courseSectionId }: {
  chapter: Chapter;
  subjectId: string;
  courseSectionId: string;
}) {
  return <LessonBatchForm chapter={chapter} courseSectionId={courseSectionId} kind="course" subjectId={subjectId} />;
}

export function CreateSubjectTemplateLessonsForm({ chapter, courseSectionCount, subjectId }: {
  chapter: Chapter;
  courseSectionCount: number;
  subjectId: string;
}) {
  return <LessonBatchForm chapter={chapter} courseSectionCount={courseSectionCount} kind="template" subjectId={subjectId} />;
}
