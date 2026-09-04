"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AddActionIcon, addActionButtonClassName } from "@/components/add-action-button";
import {
  createCourseSectionChapterAction,
  type ManagementActionState,
} from "@/features/subjects/actions";

const initialState: ManagementActionState = { status: "idle" };

export function CourseSectionChapterButton({
  courseSectionId,
  subjectId,
}: {
  courseSectionId: string;
  subjectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(async (previous: ManagementActionState, formData: FormData) => {
    const result = await createCourseSectionChapterAction(subjectId, courseSectionId, previous, formData);
    if (result.status === "success") {
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    }
    return result;
  }, initialState);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="shrink-0">
      <button className={addActionButtonClassName} onClick={() => setOpen(true)} ref={triggerRef} type="button">
        <AddActionIcon />
        <span>Thêm chương</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[3px]">
          <section aria-labelledby="course-chapter-title" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-[#f8fbf8] p-6 shadow-2xl sm:p-7" role="dialog">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">COURSE SECTION</p>
                <h2 className="mt-2 text-2xl font-bold" id="course-chapter-title">Thêm chương riêng</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Chương này chỉ thuộc lớp học phần hiện tại và không làm thay đổi Lesson Plan của môn học.</p>
              </div>
              <button className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold shadow-sm transition hover:bg-black/5" onClick={closeDialog} ref={closeRef} type="button">Đóng</button>
            </div>

            <form action={action} className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" ref={formRef}>
              <label className="text-sm font-bold" htmlFor="course-section-chapter-name">Tên chương</label>
              <input
                autoFocus
                className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
                id="course-section-chapter-name"
                maxLength={120}
                name="name"
                placeholder="Ví dụ: Chương 6: Cây"
                required
              />
              {state.status === "error" ? <p className="mt-3 text-sm text-red-800" role="alert">{state.message}</p> : null}
              <div className="mt-4 flex justify-end gap-3">
                <button className="min-h-10 rounded-xl border border-black/20 bg-white px-5 py-2 text-sm font-bold shadow-sm transition hover:bg-black/5" disabled={pending} onClick={closeDialog} type="button">Hủy</button>
                <button className="min-h-10 rounded-xl border border-emerald-200 bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} type="submit">
                  {pending ? "Đang thêm…" : "Xác nhận"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
