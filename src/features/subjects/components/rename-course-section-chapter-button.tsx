"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  type ManagementActionState,
  updateCourseSectionChapterAction,
} from "@/features/subjects/actions";

const initialState: ManagementActionState = { status: "idle" };

export function RenameCourseSectionChapterButton({
  chapterId,
  chapterName,
  courseSectionId,
  subjectId,
}: {
  chapterId: string;
  chapterName: string;
  courseSectionId: string;
  subjectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(
    async (previous: ManagementActionState, formData: FormData) => {
      const result = await updateCourseSectionChapterAction(
        subjectId,
        courseSectionId,
        chapterId,
        previous,
        formData,
      );
      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) closeDialog();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, pending]);

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <>
      <button
        className="flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Đổi tên chương
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) closeDialog();
          }}
        >
          <section aria-labelledby="rename-course-chapter-title" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-[#f8fbf8] p-6 shadow-2xl sm:p-7" role="dialog">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">CHAPTER</p>
                <h2 className="mt-2 text-2xl font-bold" id="rename-course-chapter-title">Đổi tên chương</h2>
              </div>
              <button className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-bold shadow-sm" disabled={pending} onClick={closeDialog} ref={closeRef} type="button">Đóng</button>
            </div>
            <form action={action} className="mt-6">
              <label className="text-sm font-bold" htmlFor={`chapter-name-${chapterId}`}>Tên chương</label>
              <input
                autoFocus
                className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
                defaultValue={chapterName}
                id={`chapter-name-${chapterId}`}
                maxLength={120}
                name="name"
                required
              />
              {state.fieldErrors?.name ? <p className="mt-2 text-sm text-red-700">{state.fieldErrors.name[0]}</p> : null}
              {state.status === "error" && state.message ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{state.message}</p> : null}
              <div className="mt-6 flex justify-end gap-3">
                <button className="min-h-11 rounded-xl border border-black/15 bg-white px-5 py-2.5 font-bold shadow-sm" disabled={pending} onClick={closeDialog} type="button">Hủy</button>
                <button className="min-h-11 rounded-xl bg-[var(--accent)] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50" disabled={pending} type="submit">
                  {pending ? "Đang lưu…" : "Lưu tên chương"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
