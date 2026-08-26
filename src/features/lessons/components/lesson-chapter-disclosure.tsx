"use client";

import { useId, useState, type ReactNode } from "react";

export function LessonChapterDisclosure({
  children,
  defaultOpen = false,
  lessonCount,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  lessonCount: number;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={`overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none ${open ? "border-emerald-200 shadow-md" : "border-black/10 shadow-sm"}`}>
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] motion-reduce:transition-none ${open ? "bg-emerald-50/70" : "bg-white"}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="font-bold text-[var(--accent)]">{title}</span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-bold text-emerald-900">{lessonCount} Lesson</span>
          <span className={`flex size-8 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-180 border-emerald-300 bg-white text-[var(--accent)]" : "rotate-0 border-black/10 bg-black/[0.025] text-[#526057]"}`}>
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
              <path d="m6.5 9 5.5 5.5L17.5 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
            </svg>
          </span>
        </span>
      </button>

      <div
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        id={contentId}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  );
}
