"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { readChapterPreviewAction } from "@/features/catalog/preview-actions";
import type { ChapterPreview } from "@/features/catalog/chapter-preview";
import { LessonReviewPlayer } from "@/features/lessons/components/lesson-review-player";
import { ensureAnonymousSession } from "@/lib/supabase/client";

export function ChapterPreviewView({ chapterId, header, initialMessage, initialPreview, mssv }: {
  chapterId: string;
  header: ReactNode;
  initialMessage?: string;
  initialPreview: ChapterPreview | null;
  mssv: string;
}) {
  const [preview, setPreview] = useState<ChapterPreview | null>(initialPreview);
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState(initialMessage);
  const selectedLesson = preview?.lessons.find((lesson) => lesson.id === selectedId) ?? preview?.lessons[0];

  // Re-check access after a real network reconnect. Switching browser tabs
  // must not invoke a Server Action because that triggers a Next.js render.
  useEffect(() => {
    if (!preview) return;
    let disposed = false;
    let syncing = false;
    async function sync() {
      if (disposed || syncing) return;
      syncing = true;
      try {
        await ensureAnonymousSession();
        const result = await readChapterPreviewAction(chapterId, mssv);
        if (disposed) return;
        if (result.status === "success") {
          setPreview(result.preview);
          return;
        }
        setPreview(null);
        setMessage(result.message);
      } catch {
        if (disposed) return;
        setPreview(null);
        setMessage("Không thể xác minh lại quyền xem trước. Hãy kiểm tra kết nối và thử lại.");
      } finally {
        syncing = false;
      }
    }
    window.addEventListener("online", sync);
    return () => {
      disposed = true;
      window.removeEventListener("online", sync);
    };
  }, [chapterId, mssv, preview]);

  if (preview) return (
    <>
      <div className="w-full">{header}</div>
      <section className="mt-8 space-y-5" aria-label="Nội dung xem trước">
        <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Chọn Lesson xem trước">
          {preview.lessons.map((lesson) => (
            <button
              aria-pressed={selectedLesson?.id === lesson.id}
              className={`min-h-11 shrink-0 rounded-xl border px-4 py-3 font-bold transition ${selectedLesson?.id === lesson.id ? "border-emerald-700 bg-emerald-700 text-white" : "border-black/10 bg-white hover:border-emerald-400 hover:text-[var(--accent)]"}`}
              key={lesson.id}
              onClick={() => setSelectedId(lesson.id)}
              type="button"
            >{lesson.title}</button>
          ))}
        </nav>
        {selectedLesson ? <LessonReviewPlayer key={selectedLesson.id} lesson={selectedLesson} /> : <p>Chương chưa có nội dung.</p>}
      </section>
    </>
  );

  return (
    <>
      <div className="w-full">{header}</div>
      <div
        aria-live="polite"
        className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
        role="alert"
      >
        {message ?? "Không thể mở nội dung chương."}
      </div>
    </>
  );
}
