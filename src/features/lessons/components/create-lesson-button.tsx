"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AddActionIcon, addActionButtonClassName } from "@/components/add-action-button";
import type { Chapter } from "@/features/subjects/server/queries";

export function CreateLessonButton({ baseHref, chapters }: { baseHref: string; chapters: Chapter[] }) {
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="shrink-0">
      <button className={addActionButtonClassName} onClick={() => setOpen(true)} ref={triggerRef} type="button">
        <AddActionIcon />
        <span>Tạo Lesson</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[3px]">
          <section aria-labelledby="choose-chapter-title" aria-modal="true" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-200 bg-[#f8fbf8] p-6 shadow-2xl sm:p-7" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">NEW LESSON</p>
                <h2 className="mt-2 text-2xl font-bold" id="choose-chapter-title">Chọn chương</h2>
              </div>
              <button className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold shadow-sm transition hover:bg-black/5" onClick={closeDialog} ref={closeRef} type="button">Hủy</button>
            </div>
            {chapters.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-dashed border-black/15 bg-white p-6 text-center leading-7 text-[var(--muted)]">
                Lesson Plan chưa có chương. Hãy thêm chương ở trang môn học trước khi tạo Lesson.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <Link className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white px-5 py-3 font-semibold shadow-sm transition hover:border-[var(--accent)] hover:bg-emerald-50 hover:text-[var(--accent)]" href={`${baseHref}?chapterId=${chapter.id}`}>
                      <span>{chapter.name}</span>
                      <span aria-hidden="true" className="text-xl">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
