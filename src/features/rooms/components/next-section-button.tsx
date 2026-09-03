"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { advanceSectionAction } from "@/features/rooms/lifecycle-actions";

export function NextSectionButton({ lessonId, roomId }: { lessonId: string; roomId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function showNextSection() {
    setError(null);
    startTransition(async () => {
      const result = await advanceSectionAction(roomId, lessonId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending}
        onClick={showNextSection}
        type="button"
      >
        {isPending ? "Đang chuyển…" : "Done Section"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
