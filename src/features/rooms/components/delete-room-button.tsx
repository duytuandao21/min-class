"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { deleteRoomAction } from "@/features/rooms/lifecycle-actions";

export function DeleteRoomButton({ redirectTo = "/teacher/subjects", roomId }: { redirectTo?: string; roomId: string }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isConfirming) confirmButtonRef.current?.focus();
  }, [isConfirming]);

  function cancelDelete() {
    setIsConfirming(false);
    window.setTimeout(() => triggerButtonRef.current?.focus(), 0);
  }

  function deleteRoom() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoomAction(roomId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    });
  }

  if (!isConfirming) {
    return (
      <button className="rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50 motion-reduce:transition-none" onClick={() => setIsConfirming(true)} ref={triggerButtonRef} type="button">
        Xóa buổi học
      </button>
    );
  }

  return (
    <div aria-describedby="delete-room-description" aria-labelledby="delete-room-title" className="rounded-2xl border border-red-300 bg-red-50 p-5" role="alertdialog">
      <h3 className="text-lg font-semibold text-red-950" id="delete-room-title">Xóa vĩnh viễn buổi học này?</h3>
      <p className="mt-2 leading-7 text-red-900" id="delete-room-description">
        Session cùng toàn bộ Attendance, Participant, Quiz, Reaction, Comment và Tổng kết cá nhân sẽ bị xóa vĩnh viễn. Lesson gốc vẫn được giữ lại. Thao tác này không thể hoàn tác.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="rounded-xl bg-red-700 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={isPending} onClick={deleteRoom} ref={confirmButtonRef} type="button">
          {isPending ? "Đang xóa…" : "Xác nhận xóa vĩnh viễn"}
        </button>
        <button className="rounded-xl border border-red-200 bg-white px-5 py-2.5 font-semibold text-red-800 disabled:opacity-50" disabled={isPending} onClick={cancelDelete} type="button">
          Hủy
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-800" role="alert">{error}</p> : null}
    </div>
  );
}
