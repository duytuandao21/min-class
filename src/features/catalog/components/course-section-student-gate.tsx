"use client";

import { useCallback, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { BackLink } from "@/components/back-link";
import {
  forgetCourseSectionMssv,
  rememberCourseSectionMssv,
} from "@/features/catalog/course-section-student-session";
import {
  forgetCourseSectionStudentAction,
  verifyCourseSectionStudentAction,
} from "@/features/catalog/preview-actions";
import { ensureAnonymousSession } from "@/lib/supabase/client";

type GateState =
  | { status: "form"; message?: string }
  | { status: "verified"; mssv: string };

export function CourseSectionStudentGate({ backHref, children, courseSectionCode, courseSectionId, displayName, initialMssv }: {
  backHref: string;
  children: ReactNode;
  courseSectionCode: string;
  courseSectionId: string;
  displayName: string | null;
  initialMssv: string | null;
}) {
  const [mssv, setMssv] = useState(initialMssv ?? "");
  const [state, setState] = useState<GateState>(initialMssv
    ? { status: "verified", mssv: initialMssv }
    : { status: "form" });
  const [pending, startTransition] = useTransition();

  const verify = useCallback((candidate: string) => {
    startTransition(async () => {
      try {
        await ensureAnonymousSession();
        const result = await verifyCourseSectionStudentAction(courseSectionId, candidate);
        if (result.status === "success") {
          rememberCourseSectionMssv(courseSectionId, result.mssv);
          setMssv(result.mssv);
          setState({ status: "verified", mssv: result.mssv });
          return;
        }
        forgetCourseSectionMssv(courseSectionId);
        setState({ status: "form", message: result.message });
      } catch {
        setState({ status: "form", message: "Không thể khởi tạo phiên. Hãy kiểm tra kết nối và thử lại." });
      }
    });
  }, [courseSectionId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) verify(mssv);
  }

  const accessHeader = (
    <>
      <BackLink href={backHref} label="Lớp học phần" />
      <header className="mt-10">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">COURSE SECTION</p>
        <h1 className="mt-4 break-words text-4xl font-semibold tracking-tight sm:text-5xl">{courseSectionCode}</h1>
        {displayName ? <p className="mt-3 leading-7 text-[var(--muted)]">{displayName}</p> : null}
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
          Nhập MSSV để xem các bài học của lớp học phần.
        </p>
      </header>
    </>
  );

  if (state.status === "verified") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
        <BackLink href={backHref} label="Lớp học phần" />
        <header className="my-10 flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm font-bold tracking-[0.2em] text-[var(--muted)]">COURSE SECTION</p>
            <h1 className="mt-4 break-words text-4xl font-bold tracking-[-0.035em] text-[var(--accent)] sm:text-5xl">{courseSectionCode}</h1>
            {displayName ? <p className="mt-3 text-lg font-medium text-[var(--muted)]">{displayName}</p> : null}
            <p className="mt-4 text-lg text-[var(--muted)]">Chọn chương để xem nội dung hoặc tham gia chương đang LIVE.</p>
          </div>
          <div className="ml-auto inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-1.5 text-emerald-950 shadow-sm">
            <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
              <svg className="size-3" fill="none" viewBox="0 0 16 16">
                <path d="m4 8 2.5 2.5L12 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </span>
            <strong className="text-sm font-semibold tracking-wide">{state.mssv}</strong>
            <button
              aria-label="Đổi MSSV"
              className="ml-2 rounded-full px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-900"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await forgetCourseSectionStudentAction(courseSectionId);
                  forgetCourseSectionMssv(courseSectionId);
                  setMssv("");
                  setState({ status: "form" });
                });
              }}
              title="Đổi MSSV"
              type="button"
            >
              Đổi
            </button>
          </div>
        </header>
        {children}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12 sm:px-10">
      {accessHeader}
      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="course-section-mssv">MSSV</label>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 uppercase outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            id="course-section-mssv"
            inputMode="text"
            maxLength={32}
            minLength={3}
            name="mssv"
            onChange={(event) => setMssv(event.target.value)}
            required
            value={mssv}
          />
        </div>
        {state.message ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.message}</p> : null}
        <button
          className="w-full rounded-xl bg-[#17201b] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Đang xác minh…" : "Truy cập lớp học phần"}
        </button>
      </form>
    </main>
  );
}
