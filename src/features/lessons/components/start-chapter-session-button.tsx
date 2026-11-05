"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startChapterSessionAction } from "@/features/lessons/session-actions";

export function StartChapterSessionButton({ chapterId, courseSectionId, chapterName }: { chapterId: string; courseSectionId: string; chapterName?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end">
      <button
        aria-label={chapterName ? `Bắt đầu LIVE ${chapterName}` : undefined}
        className="group inline-flex min-h-11 items-center gap-2.5 rounded-xl border border-sky-300 bg-gradient-to-r from-sky-100 to-cyan-100 px-3.5 py-2 text-sm font-bold text-sky-950 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400 hover:from-sky-200 hover:to-cyan-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await startChapterSessionAction({ chapterId, courseSectionId });
              if (!result.ok) return setError(result.message);
              router.push(`/teacher/rooms/${result.sessionId}`);
            } catch {
              setError("Không thể bắt đầu LIVE. Hãy kiểm tra kết nối và thử lại.");
            }
          });
        }}
        type="button"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm ring-1 ring-sky-700/20 transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none">
          <svg aria-hidden="true" className="ml-0.5 size-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.75 3.9a1 1 0 0 1 1.52-.85l9.05 6.1a1 1 0 0 1 0 1.7l-9.05 6.1a1 1 0 0 1-1.52-.85V3.9Z" />
          </svg>
        </span>
        {pending ? "Đang bắt đầu…" : "Live"}
      </button>
      {error ? (
        <div className="mt-2 max-w-xs text-right text-xs text-red-700">
          <p role="alert">{error}</p>
          <button className="mt-1 rounded-md px-2 py-1 font-bold underline underline-offset-2 hover:bg-red-50" onClick={() => router.refresh()} type="button">Tải lại trang</button>
        </div>
      ) : null}
    </div>
  );
}
