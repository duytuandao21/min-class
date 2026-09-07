"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { accessPublicLessonAction, type LessonAccessState } from "@/features/catalog/actions";
import {
  forgetCourseSectionMssv,
  getRememberedCourseSectionMssv,
  rememberCourseSectionMssv,
} from "@/features/catalog/course-section-student-session";
import type { PublicLessonStatus } from "@/features/catalog/schemas";
import { ensureAnonymousSession } from "@/lib/supabase/client";

const initialState: LessonAccessState = { status: "idle" };

export function LessonAccessForm({
  courseSectionId,
  lessonId,
  scope = "lesson",
  status,
}: {
  courseSectionId?: string;
  lessonId: string;
  scope?: "chapter" | "lesson";
  status: PublicLessonStatus;
}) {
  if (status === "ENDED" && courseSectionId) {
    return <RememberedEndedChapterAccess courseSectionId={courseSectionId} lessonId={lessonId} />;
  }

  return (
    <ManualLessonAccessForm
      courseSectionId={courseSectionId}
      lessonId={lessonId}
      scope={scope}
      status={status}
    />
  );
}

function ManualLessonAccessForm({ courseSectionId, lessonId, scope, status }: {
  courseSectionId?: string;
  lessonId: string;
  scope: "chapter" | "lesson";
  status: PublicLessonStatus;
}) {
  const action = useCallback(async (previousState: LessonAccessState, formData: FormData) => {
    try {
      await ensureAnonymousSession();
    } catch {
      return {
        status: "error" as const,
        message: "Không thể khởi tạo phiên. Hãy kiểm tra kết nối và thử lại.",
      };
    }

    const result = await accessPublicLessonAction(lessonId, status, previousState, formData);
    if (result.status === "success" && courseSectionId) {
      rememberCourseSectionMssv(courseSectionId, String(formData.get("mssv") ?? ""));
    }
    return result;
  }, [courseSectionId, lessonId, status]);
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.sessionId) {
      router.push(status === "ENDED"
        ? `/learn/review/${state.sessionId}?lessonId=${state.lessonId ?? lessonId}`
        : `/student/rooms/${state.sessionId}`);
    }
  }, [lessonId, router, state.lessonId, state.sessionId, state.status, status]);

  if (status === "UPCOMING") {
    return (
      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950" role="status">
        {scope === "chapter" ? "Chương" : "Lesson"} này chưa mở. Hãy quay lại khi giảng viên bắt đầu hoặc kết thúc buổi học.
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
        {pending ? "Đang xác minh…" : state.status === "success" ? "Đã xác minh" : scope === "chapter" ? "Truy cập chương" : "Truy cập Lesson"}
      </button>
    </form>
  );
}

function RememberedEndedChapterAccess({ courseSectionId, lessonId }: {
  courseSectionId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<LessonAccessState>({ status: "idle" });

  useEffect(() => {
    let disposed = false;
    async function accessEndedChapter() {
      await Promise.resolve();
      if (disposed) return;
      const rememberedMssv = getRememberedCourseSectionMssv(courseSectionId);
      if (!rememberedMssv) {
        setState({ status: "error", message: "Hãy quay lại lớp học phần và nhập MSSV để xem các chương." });
        return;
      }
      try {
        await ensureAnonymousSession();
        const formData = new FormData();
        formData.set("mssv", rememberedMssv);
        const result = await accessPublicLessonAction(lessonId, "ENDED", initialState, formData);
        if (disposed) return;
        if (result.status === "success" && result.sessionId) {
          router.push(`/learn/review/${result.sessionId}?lessonId=${result.lessonId ?? lessonId}`);
          return;
        }
        forgetCourseSectionMssv(courseSectionId);
        setState(result);
      } catch {
        if (!disposed) setState({ status: "error", message: "Không thể xác minh quyền truy cập Lesson." });
      }
    }
    void accessEndedChapter();
    return () => { disposed = true; };
  }, [courseSectionId, lessonId, router]);

  return (
    <div
      aria-live="polite"
      className={`mt-8 rounded-2xl border px-5 py-4 text-sm ${state.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-black/10 bg-black/[0.03] text-[var(--muted)]"}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.status === "error" ? state.message : "Đang xác minh MSSV và mở nội dung chương…"}
    </div>
  );
}
