"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { releaseEntireChapterAction } from "@/features/rooms/lifecycle-actions";

export function ReleaseChapterButton({ roomId }: { roomId: string }) {
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
      if (event.key === "Escape" && !isPending) cancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirming, isPending]);

  function cancel() {
    setIsConfirming(false);
    window.setTimeout(() => triggerButtonRef.current?.focus(), 0);
  }

  function releaseChapter() {
    setError(null);
    startTransition(async () => {
      const result = await releaseEntireChapterAction(roomId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIsConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="rounded-xl border border-sky-300 bg-sky-50 px-5 py-3 font-semibold text-sky-900 transition hover:-translate-y-0.5 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
        onClick={() => setIsConfirming(true)}
        ref={triggerButtonRef}
        type="button"
      >
        Done toàn bộ chương
      </button>
      {isConfirming ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) cancel();
          }}
        >
          <section
            aria-describedby="release-chapter-description"
            aria-labelledby="release-chapter-title"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl border border-sky-200 bg-[#f7fbfd] p-7 shadow-2xl sm:p-8"
            role="alertdialog"
          >
            <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sky-100 text-2xl font-black text-sky-700">✓</div>
            <h3 className="mt-5 text-center text-2xl font-bold text-sky-950" id="release-chapter-title">Done toàn bộ chương đang LIVE?</h3>
            <p className="mt-3 text-center leading-7 text-sky-900/85" id="release-chapter-description">
              Tất cả section và Quiz của mọi Lesson trong chương sẽ được mở cho sinh viên. Thao tác này không thể hoàn tác.
            </p>
            {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                className="min-h-11 rounded-xl border border-black/15 bg-white px-6 py-2.5 font-bold text-sky-950 shadow-sm disabled:opacity-50"
                disabled={isPending}
                onClick={cancel}
                type="button"
              >
                Hủy
              </button>
              <button
                className="min-h-11 rounded-xl bg-sky-700 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending}
                onClick={releaseChapter}
                ref={confirmButtonRef}
                type="button"
              >
                {isPending ? "Đang hoàn tất…" : "Xác nhận Done chương"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
