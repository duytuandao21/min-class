"use client";

import { useMemo, useState } from "react";

type RosterStudentItem = {
  id: string;
  mssv: string;
};

export function RosterStudentList({ students }: { students: RosterStudentItem[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toUpperCase();
  const filteredStudents = useMemo(
    () => students
      .map((student, index) => ({ student, index }))
      .filter(({ student }) => !normalizedQuery || student.mssv.includes(normalizedQuery)),
    [normalizedQuery, students],
  );

  return (
    <section
      className="min-w-0 rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8"
      aria-labelledby="roster-list-title"
    >
      <header className="flex flex-col gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--accent)]">DANH SÁCH LỚP</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h2 className="text-2xl font-semibold" id="roster-list-title">MSSV đã lưu</h2>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">
              {students.length} sinh viên
            </span>
          </div>
        </div>

        {students.length > 0 ? (
          <label className="relative block w-full sm:max-w-64">
            <span className="sr-only">Tìm MSSV</span>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--muted)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
            <input
              className="w-full rounded-xl border border-black/15 bg-white py-2.5 pr-4 pl-10 text-sm outline-none transition placeholder:text-black/35 focus:border-[var(--accent)] focus:ring-3 focus:ring-emerald-900/8"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm MSSV…"
              type="search"
              value={query}
            />
          </label>
        ) : null}
      </header>

      {students.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-black/15 bg-black/[0.015] p-8 text-center text-sm text-[var(--muted)]">
          Chưa có MSSV. Hãy tải lên file roster để bắt đầu.
        </p>
      ) : filteredStudents.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-amber-50 p-6 text-center text-sm text-amber-900" role="status">
          Không tìm thấy MSSV phù hợp.
        </p>
      ) : (
        <>
          <p className="mt-5 text-xs font-medium text-[var(--muted)]" aria-live="polite">
            Hiển thị {filteredStudents.length} / {students.length} MSSV
          </p>
          <ol className="mt-3 grid max-h-[30rem] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {filteredStudents.map(({ student, index }) => (
                <li
                  className="flex min-w-0 items-center gap-2.5 rounded-xl border border-black/7 bg-black/[0.025] px-3 py-2.5 transition hover:border-emerald-900/15 hover:bg-emerald-50/70 motion-reduce:transition-none"
                  key={student.id}
                >
                  <span className="w-7 shrink-0 text-right text-[0.7rem] font-medium tabular-nums text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate font-mono text-sm font-bold text-[#263129]" title={student.mssv}>
                    {student.mssv}
                  </span>
                </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
