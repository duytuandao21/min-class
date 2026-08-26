"use client";

import { useActionState } from "react";

import {
  loginTeacherAction,
  type TeacherAuthState,
} from "@/features/auth/actions";

const initialTeacherAuthState: TeacherAuthState = { status: "idle" };

export function TeacherAuthForm() {
  const [state, formAction, pending] = useActionState(loginTeacherAction, initialTeacherAuthState);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="teacher-username">
          Tên đăng nhập
        </label>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          id="teacher-username"
          name="username"
          required
          type="text"
        />
        {state.fieldErrors?.username?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>{error}</p>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="teacher-password">
          Mật khẩu
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          id="teacher-password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        {state.fieldErrors?.password?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>{error}</p>
        ))}
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
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang xử lý…" : "Đăng nhập"}
      </button>
    </form>
  );
}
