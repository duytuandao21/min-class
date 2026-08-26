"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startLessonSessionAction } from "@/features/lessons/session-actions";

export function StartLessonSessionButton({
  className = "mt-4",
  lessonId,
}: {
  className?: string;
  lessonId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startLesson() {
    setError(null);
    startTransition(async () => {
      const result = await startLessonSessionAction(lessonId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/teacher/rooms/${result.sessionId}`);
    });
  }

  return (
    <div className={className}>
      <button
        className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        onClick={startLesson}
        type="button"
      >
        {pending ? "Đang bắt đầu…" : "Start Lesson"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
