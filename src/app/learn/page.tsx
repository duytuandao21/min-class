import Link from "next/link";

import { BackLink } from "@/components/back-link";
import { getPublicSubjects } from "@/features/catalog/server/queries";

export default async function PublicSubjectsPage() {
  const subjects = await getPublicSubjects();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <BackLink href="/" label="MINCLASS" />
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">STUDENT · LESSONS</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Chọn môn học</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">Tìm lớp học phần và Lesson của bạn.</p>
      </header>

      {subjects.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Chưa có môn học để hiển thị.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {subjects.map((subject) => (
            <li key={subject.subject_id}>
              <Link className="block h-full rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md" href={`/learn/subjects/${subject.subject_id}`}>
                <span className="text-xl font-semibold">{subject.subject_name}</span>
                {subject.subject_code ? <span className="mt-2 block text-sm font-medium text-[var(--muted)]">{subject.subject_code}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
