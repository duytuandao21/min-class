"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { accessPublicLessonAction, type LessonAccessState } from "@/features/catalog/actions";
import type { PublicLessonStatus } from "@/features/catalog/schemas";

const initialState: LessonAccessState = { status: "idle" };

export function LessonAccessForm({ lessonId, status }: { lessonId: string; status: PublicLessonStatus }) {
  const action = accessPublicLessonAction.bind(null, lessonId, status);
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.sessionId) {
      router.push(status === "ENDED"
        ? `/learn/review/${state.sessionId}`
        : `/student/rooms/${state.sessionId}`);
    }
  }, [router, state.sessionId, state.status, status]);

  if (status === "UPCOMING") {
    return (
      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950" role="status">
        Lesson này chưa mở. Hãy quay lại khi giảng viên bắt đầu hoặc kết thúc buổi học.
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="lesson-mssv">MSSV</label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 uppercase outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          id="lesson-mssv"
          inputMode="text"
          name="mssv"
          required
        />
        {state.fieldErrors?.mssv?.map((error) => <p className="mt-2 text-sm text-red-700" key={error}>{error}</p>)}
      </div>

      {state.message ? (
        <p
          aria-live="polite"
          className={`rounded-xl px-4 py-3 text-sm ${state.status === "success" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-[#17201b] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || state.status === "success"}
        type="submit"
      >
        {pending ? "Đang xác minh…" : state.status === "success" ? "Đã xác minh" : "Truy cập Lesson"}
      </button>
    </form>
  );
}
