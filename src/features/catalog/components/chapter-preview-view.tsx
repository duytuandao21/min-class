"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { readChapterPreviewAction } from "@/features/catalog/preview-actions";
import type { ChapterPreview } from "@/features/catalog/chapter-preview";
import { LessonReviewPlayer } from "@/features/lessons/components/lesson-review-player";
import { ensureAnonymousSession } from "@/lib/supabase/client";

export function ChapterPreviewView({ chapterId, header }: { chapterId: string; header: ReactNode }) {
  const router = useRouter();
  const [preview, setPreview] = useState<ChapterPreview | null>(null);
  const [mssv, setMssv] = useState("");
  const [verifiedMssv, setVerifiedMssv] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const selectedLesson = preview?.lessons.find((lesson) => lesson.id === selectedId) ?? preview?.lessons[0];

  // Re-check access after a real network reconnect. Switching browser tabs
  // must not invoke a Server Action because that triggers a Next.js render.
  useEffect(() => {
    if (!verifiedMssv) return;
    let disposed = false;
    let syncing = false;
    async function sync() {
      if (disposed || syncing) return;
      syncing = true;
      try {
        await ensureAnonymousSession();
        const result = await readChapterPreviewAction(chapterId, verifiedMssv);
        if (disposed) return;
        if (result.status === "success") {
          setPreview(result.preview);
          return;
        }
        setPreview(null);
        setVerifiedMssv("");
        setMessage(result.message);
        router.refresh();
      } catch {
        if (disposed) return;
        setPreview(null);
        setVerifiedMssv("");
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
  }, [chapterId, router, verifiedMssv]);

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
    <div className="mx-auto w-full max-w-lg">
      {header}
      <form className="mt-8 space-y-5" noValidate onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      setPending(true);
      setMessage(undefined);
      try {
        await ensureAnonymousSession();
        const result = await readChapterPreviewAction(chapterId, mssv);
        if (result.status === "success") {
          setPreview(result.preview);
          setVerifiedMssv(mssv.trim().toUpperCase());
        } else setMessage(result.message);
      } catch {
        setMessage("Không thể tải nội dung. Hãy kiểm tra kết nối và thử lại.");
      } finally {
        setPending(false);
      }
      }}>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="preview-mssv">MSSV</label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 uppercase outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          id="preview-mssv"
          inputMode="text"
          maxLength={32}
          minLength={3}
          name="mssv"
          onChange={(event) => setMssv(event.target.value)}
          required
          value={mssv}
        />
      </div>
      {message ? (
        <p aria-live="polite" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {message}
        </p>
      ) : null}
      <button className="w-full rounded-xl bg-[#17201b] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Đang xác minh…" : "Xem trước chương"}
      </button>
      </form>
    </div>
  );
}
