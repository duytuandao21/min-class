"use client";

import { useState } from "react";

export function CopyRoomCodeButton({ code }: { code: string }) {
  const [message, setMessage] = useState("Copy code");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Đã copy");
    } catch {
      setMessage("Không thể copy");
    }
  }

  return (
    <button
      className="rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      onClick={copyCode}
      type="button"
    >
      {message}
    </button>
  );
}
