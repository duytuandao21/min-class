"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const buttonClassName = "inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-800";

export function EditLessonButton({ href, lessonTitle, locked }: {
  href: string;
  lessonTitle: string;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  if (!locked) return <Link className={buttonClassName} href={href}>Sửa</Link>;

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)} ref={triggerRef} type="button">Sửa</button>
      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section aria-describedby="locked-lesson-description" aria-labelledby="locked-lesson-title" aria-modal="true" className="w-full max-w-md rounded-3xl border border-amber-200 bg-[#fffbef] p-7 shadow-2xl" role="alertdialog">
            <div aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl font-black text-amber-800">!</div>
            <h2 className="mt-5 text-center text-2xl font-bold text-amber-950" id="locked-lesson-title">Không thể sửa Lesson</h2>
            <p className="mt-3 text-center leading-7 text-amber-900/85" id="locked-lesson-description">
              Lesson đã có Session nên nội dung được khóa để bảo toàn lịch sử buổi học.
            </p>
            <div className="mt-7 flex justify-center">
              <button className="min-h-11 rounded-xl bg-amber-700 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-amber-800" onClick={closeDialog} ref={closeRef} type="button">Đã hiểu</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
