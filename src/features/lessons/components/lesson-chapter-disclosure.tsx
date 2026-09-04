"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

export function LessonChapterDisclosure({
  actions,
  children,
  defaultOpen = false,
  lessonCount,
  title,
  titleHref,
}: {
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  lessonCount: number;
  title: string;
  titleHref?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={`overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none ${open ? "border-emerald-200 shadow-md" : "border-black/10 shadow-sm"}`}>
      <div className={`flex items-center gap-3 px-3 py-2 transition-colors duration-300 motion-reduce:transition-none ${open ? "bg-emerald-50/70" : "bg-white"}`}>
        {titleHref ? (
          <Link
            className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            href={titleHref}
          >
            <span className="block truncate font-bold text-[var(--accent)]">{title}</span>
            <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">Nhấn để truy cập chương</span>
          </Link>
        ) : (
          <button
            aria-controls={contentId}
            aria-expanded={open}
            className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            <span className="block truncate font-bold text-[var(--accent)]">{title}</span>
          </button>
        )}
        {actions ? <div className="shrink-0">{actions}</div> : null}
        <button
          aria-controls={contentId}
          aria-expanded={open}
          aria-label={open ? `Thu gọn ${title}` : `Mở rộng ${title}`}
          className="flex shrink-0 items-center gap-3 rounded-xl p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className="rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-bold text-emerald-900">{lessonCount} Lesson</span>
          <span className={`flex size-8 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-180 border-emerald-300 bg-white text-[var(--accent)]" : "rotate-0 border-black/10 bg-black/[0.025] text-[#526057]"}`}>
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
              <path d="m6.5 9 5.5 5.5L17.5 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
            </svg>
          </span>
        </button>
      </div>

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
