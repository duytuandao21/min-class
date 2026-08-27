"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { AddActionIcon, addActionButtonClassName } from "@/components/add-action-button";
import {
  createChapterAction,
  type ManagementActionState,
  updateChapterAction,
} from "@/features/subjects/actions";
import type { Chapter } from "@/features/subjects/server/queries";

const initialState: ManagementActionState = { status: "idle" };
const inputClassName = "w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";
const cancelButtonClassName = "min-h-10 rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold text-[#263129] shadow-sm transition hover:border-black/35 hover:bg-black/5";

function ActionMessage({ state }: { state: ManagementActionState }) {
  if (!state.message || state.status === "success") return null;
  return <p className="mt-3 text-sm text-red-800" role="alert">{state.message}</p>;
}

function AddChapterForm({ onCancel, subjectId }: { onCancel: () => void; subjectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const actionWithSubject = createChapterAction.bind(null, subjectId);
  const [state, action, pending] = useActionState(async (previousState: ManagementActionState, formData: FormData) => {
    const result = await actionWithSubject(previousState, formData);
    if (result.status === "success") {
      formRef.current?.reset();
      onCancel();
    }
    return result;
  }, initialState);

  return (
    <form action={action} className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" ref={formRef}>
      <label className="text-sm font-semibold" htmlFor="new-chapter-name">Tên chương</label>
      <input autoFocus className={`mt-2 ${inputClassName}`} id="new-chapter-name" maxLength={120} name="name" placeholder="Ví dụ: Chương 1: Giới thiệu" required />
      <ActionMessage state={state} />
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button className={cancelButtonClassName} disabled={pending} onClick={onCancel} type="button">Hủy</button>
        <button className={addActionButtonClassName} disabled={pending} type="submit">
          <AddActionIcon />
          <span>{pending ? "Đang thêm…" : "Thêm chương"}</span>
        </button>
      </div>
    </form>
  );
}

function ChapterRow({ chapter, subjectId }: { chapter: Chapter; subjectId: string }) {
  const [editing, setEditing] = useState(false);
  const updateWithIds = updateChapterAction.bind(null, subjectId, chapter.id);
  const [state, action, pending] = useActionState(async (previousState: ManagementActionState, formData: FormData) => {
    const result = await updateWithIds(previousState, formData);
    if (result.status === "success") setEditing(false);
    return result;
  }, initialState);

  if (editing) {
    return (
      <li className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <form action={action}>
          <label className="sr-only" htmlFor={`chapter-name-${chapter.id}`}>Tên chương</label>
          <input autoFocus className={inputClassName} defaultValue={chapter.name} id={`chapter-name-${chapter.id}`} maxLength={120} name="name" required />
          <ActionMessage state={state} />
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button className={cancelButtonClassName} disabled={pending} onClick={() => setEditing(false)} type="button">Hủy</button>
            <button className="min-h-10 rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50" disabled={pending} type="submit">
              {pending ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-sm">
      <span className="min-w-0 break-words font-semibold">{chapter.name}</span>
      <button className="shrink-0 rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => setEditing(true)} type="button">
        Sửa
      </button>
    </li>
  );
}

export function LessonPlanManager({ chapters, subjectId }: { chapters: Chapter[]; subjectId: string }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function closeDialog() {
    setAdding(false);
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="shrink-0">
      <button className="rounded-xl border border-[var(--accent)] bg-white px-5 py-3 font-semibold text-[var(--accent)] shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none" onClick={() => setOpen(true)} ref={triggerRef} type="button">
        Lesson Plan
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[3px]">
          <section aria-labelledby="lesson-plan-title" aria-modal="true" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-3xl border border-emerald-200 bg-[#f8fbf8] p-6 shadow-2xl sm:p-7" role="dialog">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">LESSON PLAN</p>
                <h2 className="mt-2 text-2xl font-bold" id="lesson-plan-title">Danh sách chương</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className={addActionButtonClassName} onClick={() => setAdding(true)} type="button">
                  <AddActionIcon />
                  <span>Thêm</span>
                </button>
                <button className={cancelButtonClassName} onClick={closeDialog} ref={closeRef} type="button">Đóng</button>
              </div>
            </div>

            {adding ? <AddChapterForm onCancel={() => setAdding(false)} subjectId={subjectId} /> : null}

            <div className="mt-5 min-h-0 overflow-y-auto pr-1">
              {chapters.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Chưa có chương trong Lesson Plan.</p>
              ) : (
                <ol className="space-y-3">
                  {chapters.map((chapter) => <ChapterRow chapter={chapter} key={chapter.id} subjectId={subjectId} />)}
                </ol>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
