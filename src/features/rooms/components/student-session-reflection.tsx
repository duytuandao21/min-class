"use client";

import { useActionState } from "react";

import {
  saveSessionReflectionAction,
  type SessionReflectionState,
} from "@/features/rooms/session-reflection-actions";
import type { SessionReflection } from "@/features/rooms/session-reflection";

export function StudentSessionReflection({
  initialReflection,
  roomId,
}: {
  initialReflection: SessionReflection | null;
  roomId: string;
}) {
  const action = saveSessionReflectionAction.bind(null, roomId);
  const initialState: SessionReflectionState = {
    status: "idle",
    reflection: initialReflection ?? undefined,
  };
  const [state, formAction, pending] = useActionState(action, initialState);
  const savedReflection = state.reflection ?? initialReflection;

  if (savedReflection) {
    return (
      <section className="mt-7 rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white to-emerald-50/60 p-7 shadow-sm sm:p-9" aria-labelledby="session-reflection-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">TỔNG KẾT CÁ NHÂN</p>
            <h2 className="mt-2 text-3xl font-semibold" id="session-reflection-title">Tổng kết của bạn đã được ghi nhận</h2>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-900">Đã gửi</span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-5">
            <p className="text-sm text-[var(--muted)]">Số lần phát biểu</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--accent)]">{savedReflection.speakingCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-5">
            <p className="text-sm text-[var(--muted)]">Review buổi học</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-lg leading-8">
              {savedReflection.reviewBody ?? "Bạn không viết review."}
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm text-[var(--muted)]">Tổng kết chỉ được gửi một lần và vẫn có thể xem lại trong Lesson Review.</p>
      </section>
    );
  }

  return (
    <section className="mt-7 rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white to-emerald-50/60 p-7 shadow-sm sm:p-9" aria-labelledby="session-reflection-title">
      <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">TỔNG KẾT CÁ NHÂN</p>
      <h2 className="mt-2 text-3xl font-semibold" id="session-reflection-title">
        Bạn đã đóng góp gì trong buổi học?
      </h2>
      <p className="mt-3 text-lg leading-8 text-[var(--muted)]">
        Tự ghi lại số lần phát biểu và một lời review ngắn về buổi học hôm nay.
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        <div>
          <label className="block font-semibold" htmlFor="session-speaking-count">
            Số lần bạn phát biểu
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-lg font-semibold outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-emerald-100"
            defaultValue={0}
            id="session-speaking-count"
            inputMode="numeric"
            max={999}
            min={0}
            name="speakingCount"
            required
            step={1}
            type="number"
          />
          {state.fieldErrors?.speakingCount?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>{error}</p>
          ))}
        </div>

        <div>
          <label className="block font-semibold" htmlFor="session-review-body">
            Review buổi học <span className="font-normal text-[var(--muted)]">(không bắt buộc)</span>
          </label>
          <textarea
            className="mt-2 min-h-36 w-full resize-y rounded-xl border border-black/15 bg-white px-5 py-4 text-lg leading-8 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-emerald-100"
            id="session-review-body"
            maxLength={1000}
            name="reviewBody"
            placeholder="Điều bạn nhớ nhất, cảm nhận hoặc lời nhắn sau buổi học…"
          />
          {state.fieldErrors?.reviewBody?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>{error}</p>
          ))}
        </div>

        {state.message ? (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${state.status === "success" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        ) : null}

        <button
          className="w-full rounded-xl bg-[var(--accent)] px-6 py-4 text-lg font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Đang gửi…" : "Gửi tổng kết"}
        </button>
      </form>
    </section>
  );
}
