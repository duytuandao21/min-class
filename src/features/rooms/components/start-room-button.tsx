"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startRoomAction } from "@/features/rooms/lifecycle-actions";

export function StartRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startRoom() {
    setError(null);
    startTransition(async () => {
      const result = await startRoomAction(roomId);
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
        onClick={startRoom}
        type="button"
      >
        {isPending ? "Đang bắt đầu…" : "Start Room"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
