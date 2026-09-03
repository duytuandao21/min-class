"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { AddActionIcon, addActionButtonClassName } from "@/components/add-action-button";
import { DeleteLessonButton } from "@/features/lessons/components/delete-lesson-button";
import { createChapterAction, deleteChapterAction, type ManagementActionState, updateChapterAction } from "@/features/subjects/actions";
import type { Chapter, TemplateLesson } from "@/features/subjects/server/queries";

const initialState: ManagementActionState = { status: "idle" };
const inputClassName = "w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";
const cancelButtonClassName = "min-h-10 rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold text-[#263129] shadow-sm transition hover:bg-black/5";

function ActionMessage({ state }: { state: ManagementActionState }) {
  if (!state.message || state.status === "success") return null;
  return <p className="mt-3 text-sm text-red-800" role="alert">{state.message}</p>;
}

function AddChapterForm({ onCancel, subjectId }: { onCancel: () => void; subjectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (previous: ManagementActionState, data: FormData) => {
    const result = await createChapterAction(subjectId, previous, data);
    if (result.status === "success") { formRef.current?.reset(); onCancel(); }
    return result;
  }, initialState);
  return (
    <form action={action} className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" ref={formRef}>
      <label className="text-sm font-semibold" htmlFor="new-chapter-name">Tên chương</label>
      <input autoFocus className={`mt-2 ${inputClassName}`} id="new-chapter-name" maxLength={120} name="name" placeholder="Ví dụ: Chương 1: Giới thiệu" required />
      <ActionMessage state={state} />
      <div className="mt-4 flex justify-end gap-3">
        <button className={cancelButtonClassName} disabled={pending} onClick={onCancel} type="button">Hủy</button>
        <button
          className="min-h-10 rounded-xl border border-emerald-200 bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Đang xác nhận…" : "Xác nhận"}
        </button>
      </div>
    </form>
  );
}

function ChapterGroup({ chapter, lessons, subjectId }: { chapter: Chapter; lessons: TemplateLesson[]; subjectId: string }) {
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();
  const [state, action, pending] = useActionState(async (previous: ManagementActionState, data: FormData) => {
    const result = await updateChapterAction(subjectId, chapter.id, previous, data);
    if (result.status === "success") setEditing(false);
    return result;
  }, initialState);

  function removeChapter() {
    startDeleting(async () => {
      try { await deleteChapterAction(subjectId, chapter.id); }
      catch { setDeleteError("Chỉ có thể xóa chương khi không còn Lesson mẫu hoặc Lesson của lớp học phần tham chiếu đến chương."); }
    });
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/60 px-5 py-4">
        {editing ? (
          <form action={action} className="flex min-w-0 flex-1 flex-wrap gap-2">
            <input autoFocus className={`min-w-52 flex-1 ${inputClassName}`} defaultValue={chapter.name} maxLength={120} name="name" required />
            <button className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white" disabled={pending}>Lưu</button>
            <button className={cancelButtonClassName} onClick={() => setEditing(false)} type="button">Hủy</button>
            <ActionMessage state={state} />
          </form>
        ) : (
          <>
            <div><h3 className="font-bold">{chapter.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{lessons.length} Lesson mẫu</p></div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-black/15 px-3 py-2 text-sm font-bold" onClick={() => setEditing(true)} type="button">Sửa</button>
              <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50" disabled={deleting} onClick={removeChapter} type="button">Xóa</button>
            </div>
          </>
        )}
      </div>
      {deleteError ? <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800" role="alert">{deleteError}</p> : null}
      <div className="border-t border-black/10 p-3">
        {lessons.length === 0 ? <p className="p-3 text-sm text-[var(--muted)]">Chưa có Lesson mẫu.</p> : (
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3" key={lesson.id}>
                <span className="font-semibold">{lesson.title}</span>
                <div className="flex flex-wrap gap-2">
                  <a className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800" href={`/teacher/lessons/${lesson.id}/download`}>Tải .md</a>
                  <Link className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-bold text-white" href={`/teacher/subjects/${subjectId}/lessons/${lesson.id}`}>Chỉnh sửa</Link>
                  <DeleteLessonButton courseSectionId={null} lessonId={lesson.id} lessonTitle={lesson.title} subjectId={subjectId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function LessonPlanManager({ chapters, defaultOpen = false, subjectId, templateLessons }: {
  chapters: Chapter[];
  defaultOpen?: boolean;
  subjectId: string;
  templateLessons: TemplateLesson[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(defaultOpen && chapters.length === 0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const lessonsByChapter = new Map(chapters.map((chapter) => [chapter.id, []] as [string, TemplateLesson[]]));
  for (const lesson of templateLessons) lessonsByChapter.get(lesson.chapter_id)?.push(lesson);

  return (
    <div className="shrink-0">
      <button className="rounded-xl border border-[var(--accent)] bg-white px-5 py-3 font-semibold text-[var(--accent)] shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-md motion-reduce:transform-none" onClick={() => setOpen(true)} ref={triggerRef} type="button">Lesson Plan</button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[3px]">
          <section aria-labelledby="lesson-plan-title" aria-modal="true" className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col rounded-3xl border border-emerald-200 bg-[#f8fbf8] p-6 shadow-2xl sm:p-7" role="dialog">
            <button className={`${cancelButtonClassName} absolute right-6 top-6 sm:right-7 sm:top-7`} onClick={() => setOpen(false)} ref={closeRef} type="button">Đóng</button>
            <div className="border-b border-black/10 pb-5">
              <div className="pr-24"><p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">LESSON PLAN</p><h2 className="mt-2 text-2xl font-bold" id="lesson-plan-title">Nội dung mẫu của môn học</h2><p className="mt-2 text-sm text-[var(--muted)]">Lớp học phần mới sẽ nhận một bản sao độc lập của toàn bộ nội dung này.</p></div>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button className={addActionButtonClassName} onClick={() => setAdding(true)} type="button"><AddActionIcon />Thêm chương</button>
                {chapters.length > 0 ? <Link className={addActionButtonClassName} href={`/teacher/subjects/${subjectId}/lessons/new`}><AddActionIcon />Thêm Lesson mẫu</Link> : null}
              </div>
            </div>
            {adding ? <AddChapterForm onCancel={() => setAdding(false)} subjectId={subjectId} /> : null}
            <div className="mt-5 min-h-0 overflow-y-auto pr-1">
              {chapters.length === 0 ? <p className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Bắt đầu bằng cách thêm chương, sau đó upload các Lesson mẫu.</p> : (
                <ol className="space-y-4">{chapters.map((chapter) => <ChapterGroup chapter={chapter} key={chapter.id} lessons={lessonsByChapter.get(chapter.id) ?? []} subjectId={subjectId} />)}</ol>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
