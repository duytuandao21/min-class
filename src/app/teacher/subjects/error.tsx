"use client";

export default function SubjectsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-24 sm:px-10">
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-900" role="alert">
        <h1 className="text-2xl font-semibold">Không thể tải dữ liệu môn học</h1>
        <p className="mt-3">Kiểm tra kết nối Supabase và thử lại.</p>
        <button className="mt-6 rounded-xl bg-red-800 px-5 py-3 font-semibold text-white" onClick={reset} type="button">Thử lại</button>
      </div>
    </main>
  );
}
