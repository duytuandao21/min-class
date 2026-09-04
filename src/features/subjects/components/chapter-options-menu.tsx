"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function ChapterOptionsMenu({ children, chapterName }: { children: ReactNode; chapterName: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${open ? "Đóng" : "Mở"} thao tác cho ${chapterName}`}
        className="flex size-10 items-center justify-center rounded-xl border border-black/10 bg-white text-xl font-black text-[var(--muted)] shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden className="-mt-0.5 leading-none">⋮</span>
      </button>
      {open ? (
        <div aria-label={`Thao tác cho ${chapterName}`} className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-40 space-y-2 rounded-2xl border border-black/10 bg-white p-2 shadow-xl" role="group">
          {children}
        </div>
      ) : null}
    </div>
  );
}
