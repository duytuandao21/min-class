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
    if (!isConfirming) return;
    confirmButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) cancelEndSession();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirming, isPending]);

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

  return (
    <>
      <button className="rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50 motion-reduce:transition-none" onClick={() => setIsConfirming(true)} ref={triggerButtonRef} type="button">
        Kết thúc buổi học
      </button>
      {isConfirming ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) cancelEndSession();
          }}
        >
          <section
            aria-describedby="end-session-description"
            aria-labelledby="end-session-title"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl border border-red-200 bg-[#fff8f6] p-7 shadow-2xl sm:p-8"
            role="alertdialog"
          >
            <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-100 text-2xl font-black text-red-700">!</div>
            <h3 className="mt-5 text-center text-2xl font-bold text-red-950" id="end-session-title">Xác nhận kết thúc buổi học?</h3>
            <p className="mt-3 text-center leading-7 text-red-900/85" id="end-session-description">
              Sau khi kết thúc, Student không thể gửi thêm reaction, comment hoặc Quiz. Hệ thống sẽ mở phần tổng kết cá nhân cho Student.
            </p>
            {error ? <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button className="min-h-11 rounded-xl border border-black/15 bg-white px-6 py-2.5 font-bold text-red-950 shadow-sm disabled:opacity-50" disabled={isPending} onClick={cancelEndSession} type="button">
                Hủy
              </button>
              <button className="min-h-11 rounded-xl bg-red-700 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={isPending} onClick={endSession} ref={confirmButtonRef} type="button">
                {isPending ? "Đang kết thúc…" : "Xác nhận kết thúc"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
