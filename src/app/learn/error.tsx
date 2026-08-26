"use client";

export default function PublicCatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-900" role="alert">
        <h1 className="text-xl font-semibold">Không thể tải danh sách Lesson</h1>
        <p className="mt-2">Kiểm tra kết nối và thử lại.</p>
        <button className="mt-5 rounded-xl bg-red-900 px-5 py-2.5 font-semibold text-white" onClick={reset} type="button">Thử lại</button>
      </div>
    </main>
  );
}
