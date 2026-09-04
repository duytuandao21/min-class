"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { deleteCourseSectionChapterAction } from "@/features/subjects/actions";

export function DeleteCourseSectionChapterButton({
  chapterId,
  chapterName,
  courseSectionId,
  subjectId,
}: {
  chapterId: string;
  chapterName: string;
  courseSectionId: string;
  subjectId: string;
}) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function removeChapter() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCourseSectionChapterAction(subjectId, courseSectionId, chapterId);
      if (result.status === "error") {
        setError(result.message ?? "Không thể xóa chương.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm font-bold text-red-700 transition hover:bg-red-50"
        onClick={() => {
          setError(null);
          setConfirming(true);
          window.setTimeout(() => cancelRef.current?.focus(), 0);
        }}
        type="button"
      >
        Xóa
      </button>

      {confirming ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]">
          <section aria-describedby="delete-course-chapter-description" aria-labelledby="delete-course-chapter-title" aria-modal="true" className="w-full max-w-md rounded-3xl border border-red-200 bg-[#fff8f6] p-7 shadow-2xl" role="alertdialog">
            <div aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-100 text-2xl font-black text-red-700">!</div>
            <h2 className="mt-5 text-xl font-bold text-red-950" id="delete-course-chapter-title">Xóa chương này?</h2>
            <p className="mt-3 leading-7 text-red-900/85" id="delete-course-chapter-description">
              Chương “{chapterName}” cùng toàn bộ Lesson, Session, điểm danh, phản hồi, bình luận và kết quả Quiz liên quan sẽ bị xóa vĩnh viễn khỏi lớp học phần hiện tại.
            </p>
            <p className="mt-3 text-sm font-semibold text-red-800">Lesson Plan và các lớp học phần khác không bị ảnh hưởng. Thao tác này không thể hoàn tác.</p>
            {error ? <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="min-h-11 rounded-xl border border-black/20 bg-white px-5 py-2.5 font-bold shadow-sm" disabled={pending} onClick={() => setConfirming(false)} ref={cancelRef} type="button">Hủy</button>
              <button className="min-h-11 rounded-xl bg-red-700 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} onClick={removeChapter} type="button">
                {pending ? "Đang xóa…" : "Xóa chương"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
