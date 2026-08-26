import Link from "next/link";

import { BackLink } from "@/components/back-link";
import { CreateSubjectForm } from "@/features/subjects/components/management-forms";
import { getSubjects } from "@/features/subjects/server/queries";

export default async function SubjectsPage() {
  const subjects = await getSubjects();
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <BackLink href="/" label="MINCLASS" />
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">TEACHER · SUBJECTS</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Môn học</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">Quản lý môn học và các lớp học phần của Thầy Bảo.</p>
      </header>
      <section aria-labelledby="subject-list-title">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold" id="subject-list-title">Danh sách môn học</h2>
            <CreateSubjectForm />
          </div>
          {subjects.length === 0 ? (
            <p className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Chưa có môn học. Bấm “Thêm môn học” để bắt đầu.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {subjects.map((subject) => (
                <li key={subject.id}>
                  <Link className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md" href={`/teacher/subjects/${subject.id}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{subject.name}</span>
                      {subject.code ? <span className="mt-1 block truncate text-sm font-medium text-[var(--muted)]">{subject.code}</span> : null}
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800">{subject.courseSectionCount} lớp học phần</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>
    </main>
  );
}
