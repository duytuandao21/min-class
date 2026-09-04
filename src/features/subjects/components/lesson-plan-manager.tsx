"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";

import { DeleteLessonButton } from "@/features/lessons/components/delete-lesson-button";
import { createChapterAction, deleteChapterAction, type ManagementActionState, updateChapterAction } from "@/features/subjects/actions";
import type { Chapter, TemplateLesson } from "@/features/subjects/server/queries";

const initialState: ManagementActionState = { status: "idle" };
const inputClassName = "w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";
const cancelButtonClassName = "min-h-10 rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold text-[#263129] shadow-sm transition hover:bg-black/5";
const chapterActionClassName = "group inline-flex min-h-16 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-emerald-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none";
const lessonActionClassName = "group inline-flex min-h-16 items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sky-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 motion-reduce:transform-none";

function ActionIcon({ type }: { type: "chapter" | "lesson" }) {
  const colorClassName = type === "chapter"
    ? "border-emerald-200 bg-white text-emerald-800 group-hover:border-emerald-300"
    : "border-sky-200 bg-white text-sky-800 group-hover:border-sky-300";

  return (
    <span aria-hidden="true" className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none ${colorClassName}`}>
      {type === "chapter" ? (
        <svg className="size-6" fill="none" viewBox="0 0 24 24">
          <path d="M7 4.5h8.5A2.5 2.5 0 0 1 18 7v12H8.5A2.5 2.5 0 0 1 6 16.5V6.25A1.75 1.75 0 0 1 7.75 4.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M6 16.5A2.5 2.5 0 0 1 8.5 14H18M9.5 8h5M9.5 11h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      ) : (
        <svg className="size-7" fill="none" viewBox="0 0 28 28">
          <path d="M4 7.5c3.6-.55 6.6.1 10 2.3v13c-3.4-2.2-6.4-2.85-10-2.3v-13Zm20 0c-3.6-.55-6.6.1-10 2.3v13c3.4-2.2 6.4-2.85 10-2.3v-13Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
          <path d="M14 5.25v2M10.75 6.4 9.5 4.9m7.75 1.5 1.25-1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </svg>
      )}
      <span className={`absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full text-xs font-black text-white ring-2 ring-white ${type === "chapter" ? "bg-emerald-700" : "bg-sky-700"}`}>+</span>
    </span>
  );
}

function ActionLabel({ description, title }: { description: string; title: string }) {
  return (
    <span className="leading-tight">
      <span className="block font-extrabold">{title}</span>
      <span className="mt-1 block text-xs font-medium opacity-70">{description}</span>
    </span>
  );
}

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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();
  const contentId = useId();
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
    <li className={`overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none ${open ? "border-emerald-200 shadow-md" : "border-black/10 shadow-sm"}`}>
      <div className={`flex flex-wrap items-center gap-3 px-3 py-2 transition-colors duration-300 motion-reduce:transition-none ${open ? "bg-emerald-50/70" : "bg-white"}`}>
        {editing ? (
          <form action={action} className="flex min-w-0 flex-1 flex-wrap gap-2">
            <input autoFocus className={`min-w-52 flex-1 ${inputClassName}`} defaultValue={chapter.name} maxLength={120} name="name" required />
            <button className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white" disabled={pending}>Lưu</button>
            <button className={cancelButtonClassName} onClick={() => setEditing(false)} type="button">Hủy</button>
            <ActionMessage state={state} />
          </form>
        ) : (
          <>
            <button
              aria-controls={contentId}
              aria-expanded={open}
              className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              <span className="block truncate font-bold">{chapter.name}</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">{lessons.length} Lesson mẫu</span>
            </button>
            <div className="flex shrink-0 gap-2">
              <button className="rounded-lg border border-black/15 px-3 py-2 text-sm font-bold" onClick={() => setEditing(true)} type="button">Sửa</button>
              <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50" disabled={deleting} onClick={removeChapter} type="button">Xóa</button>
            </div>
            <button
              aria-controls={contentId}
              aria-expanded={open}
              aria-label={open ? `Thu gọn ${chapter.name}` : `Mở rộng ${chapter.name}`}
              className="shrink-0 rounded-xl p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              <span className={`flex size-9 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-180 border-emerald-300 bg-white text-[var(--accent)]" : "rotate-0 border-black/10 bg-black/[0.025] text-[#526057]"}`}>
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                  <path d="m6.5 9 5.5 5.5L17.5 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                </svg>
              </span>
            </button>
          </>
        )}
      </div>
      {deleteError ? <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800" role="alert">{deleteError}</p> : null}
      <div
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        id={contentId}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
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
        </div>
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
                <button className={chapterActionClassName} onClick={() => setAdding(true)} type="button">
                  <ActionIcon type="chapter" />
                  <ActionLabel description="Tạo nhóm nội dung" title="Thêm chương" />
                </button>
                {chapters.length > 0 ? (
                  <Link className={lessonActionClassName} href={`/teacher/subjects/${subjectId}/lessons/new`}>
                    <ActionIcon type="lesson" />
                    <ActionLabel description="Upload bài học .md" title="Thêm Lesson mẫu" />
                  </Link>
                ) : null}
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
