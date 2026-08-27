"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { endRoomAction } from "@/features/rooms/lifecycle-actions";

export function EndSessionButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isConfirming) confirmButtonRef.current?.focus();
  }, [isConfirming]);

  function cancelEndSession() {
    setIsConfirming(false);
    window.setTimeout(() => triggerButtonRef.current?.focus(), 0);
  }

  function endSession() {
    setError(null);
    startTransition(async () => {
      const result = await endRoomAction(roomId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/teacher/rooms/${roomId}/summary`);
    });
  }

  if (!isConfirming) {
    return (
      <button className="rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50 motion-reduce:transition-none" onClick={() => setIsConfirming(true)} ref={triggerButtonRef} type="button">
        Kết thúc buổi học
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alertdialog" aria-labelledby="end-session-title" aria-describedby="end-session-description">
      <h3 className="font-semibold text-red-950" id="end-session-title">Xác nhận kết thúc buổi học?</h3>
      <p className="mt-2 text-sm leading-6 text-red-900" id="end-session-description">
        Sau khi kết thúc, Student không thể gửi thêm reaction, comment hoặc Quiz. Hệ thống sẽ mở phần tổng kết cá nhân cho Student.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="rounded-xl bg-red-700 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={isPending} onClick={endSession} ref={confirmButtonRef} type="button">
          {isPending ? "Đang kết thúc…" : "Xác nhận kết thúc"}
        </button>
        <button className="rounded-xl border border-red-200 bg-white px-5 py-2.5 font-semibold text-red-800 disabled:opacity-50" disabled={isPending} onClick={cancelEndSession} type="button">
          Hủy
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-800" role="alert">{error}</p> : null}
    </div>
  );
}
