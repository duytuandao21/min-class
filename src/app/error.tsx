"use client";

export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">MINCLASS</p>
        <h1 className="mt-4 text-3xl font-semibold">Đã có lỗi xảy ra</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">
          MINCLASS chưa thể hoàn tất yêu cầu này. Vui lòng thử lại.
        </p>
        <button
          className="mt-7 rounded-full bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4"
          onClick={reset}
          type="button"
        >
          Thử lại
        </button>
      </div>
    </main>
  );
}
