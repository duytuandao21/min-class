"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteOwnedLessonAction } from "@/features/lessons/course-section-actions";

export function DeleteLessonButton({
  courseSectionId,
  lessonId,
  lessonTitle,
  returnHref,
  subjectId,
}: {
  courseSectionId: string | null;
  lessonId: string;
  lessonTitle: string;
  returnHref?: string;
  subjectId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteOwnedLessonAction(subjectId, courseSectionId, lessonId);
      if (!result.ok) {
        setError(result.errors[0] ?? "Không thể xóa Lesson.");
        return;
      }
      setConfirming(false);
      if (returnHref) router.push(returnHref);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
        onClick={() => { setError(null); setConfirming(true); }}
        type="button"
      >
        Xóa
      </button>
      {confirming ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]">
          <section aria-modal="true" className="w-full max-w-md rounded-3xl border border-red-200 bg-[#fff8f6] p-7 shadow-2xl" role="alertdialog">
            <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-100 text-2xl font-black text-red-700">!</div>
            <h2 className="mt-5 text-xl font-bold">Xóa Lesson này?</h2>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              “{lessonTitle}”{courseSectionId ? " cùng toàn bộ Session, điểm danh, phản hồi và kết quả quiz liên quan" : " cùng toàn bộ nội dung mẫu liên quan"} sẽ bị xóa vĩnh viễn.
            </p>
            {error ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-black/20 bg-white px-5 py-3 font-bold" disabled={pending} onClick={() => setConfirming(false)} type="button">Hủy</button>
              <button className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={pending} onClick={remove} type="button">{pending ? "Đang xóa…" : "Xóa Lesson"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
