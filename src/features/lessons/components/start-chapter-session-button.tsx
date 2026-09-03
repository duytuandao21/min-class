"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startChapterSessionAction } from "@/features/lessons/session-actions";

export function StartChapterSessionButton({ chapterId, courseSectionId }: { chapterId: string; courseSectionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end">
      <button
        className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startChapterSessionAction({ chapterId, courseSectionId });
            if (!result.ok) return setError(result.message);
            router.push(`/teacher/rooms/${result.sessionId}`);
          });
        }}
        type="button"
      >
        {pending ? "Đang bắt đầu…" : "Bắt đầu chương"}
      </button>
      {error ? <p className="mt-2 max-w-xs text-right text-xs text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
