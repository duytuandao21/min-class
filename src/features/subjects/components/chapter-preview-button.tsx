"use client";

import { useState, useTransition } from "react";
import { setChapterPreviewAction } from "@/features/subjects/preview-actions";

export function ChapterPreviewButton({ chapterId, enabled }: { chapterId: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  return (
    <div>
      <button
        className="flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm font-bold text-sky-900 transition hover:bg-sky-50 disabled:opacity-50"
        disabled={pending}
        onClick={() => startTransition(async () => {
          setMessage(undefined);
          try {
            const result = await setChapterPreviewAction(chapterId, !enabled);
            if (result.status === "error") setMessage(result.message);
          } catch {
            setMessage("Không thể cập nhật. Hãy thử lại.");
          }
        })}
        type="button"
      >
        {pending ? "Đang cập nhật…" : enabled ? "Đóng xem trước" : "Mở xem trước"}
      </button>
      {message ? <p className="max-w-64 px-3 py-2 text-sm text-red-800" role="alert">{message}</p> : null}
    </div>
  );
}
