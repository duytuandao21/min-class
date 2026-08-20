"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { joinRoomAction, type JoinRoomState } from "@/features/rooms/lifecycle-actions";

const initialState: JoinRoomState = { status: "idle" };

export function JoinRoomForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(joinRoomAction, initialState);

  useEffect(() => {
    if (state.status === "success" && state.roomId) {
      router.replace(`/student/rooms/${state.roomId}`);
    }
  }, [router, state]);

  return (
    <form action={formAction} className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm sm:p-9">
      <div>
        <label className="text-sm font-semibold" htmlFor="roomCode">Room Code</label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-mono text-xl uppercase tracking-[0.14em] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-emerald-700/15"
          id="roomCode"
          maxLength={6}
          name="roomCode"
          placeholder="ABC234"
          required
        />
        {state.fieldErrors?.roomCode?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>{error}</p>
        ))}
      </div>

      <div className="mt-5">
        <label className="text-sm font-semibold" htmlFor="mssv">MSSV</label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 uppercase outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-emerald-700/15"
          id="mssv"
          maxLength={32}
          minLength={3}
          name="mssv"
          placeholder="SV001"
          required
        />
        {state.fieldErrors?.mssv?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>{error}</p>
        ))}
      </div>

      {state.status === "error" && state.message ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        className="mt-7 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending || state.status === "success"}
        type="submit"
      >
        {isPending || state.status === "success" ? "Đang tham gia…" : "Tham gia"}
      </button>
    </form>
  );
}
