import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { getPublicCourseSections, getPublicSubjects } from "@/features/catalog/server/queries";

export default async function PublicCourseSectionsPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const [subjects, courseSections] = await Promise.all([
    getPublicSubjects(),
    getPublicCourseSections(subjectId),
  ]);
  const subject = subjects.find((item) => item.subject_id === subjectId);
  if (!subject) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <BackLink href="/learn" label="Môn học" />
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">{subject.subject_code ?? "SUBJECT"}</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">{subject.subject_name}</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">Chọn lớp học phần của bạn.</p>
      </header>

      {courseSections.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Môn học này chưa có lớp học phần.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courseSections.map((courseSection) => (
            <li key={courseSection.course_section_id}>
              <Link className="block h-full rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md" href={`/learn/subjects/${subjectId}/sections/${courseSection.course_section_id}`}>
                <span className="block break-words text-xl font-bold text-[var(--accent)] sm:text-2xl">
                  {courseSection.section_code}
                </span>
                {courseSection.display_name ? (
                  <span className="mt-2 block text-sm font-medium text-[var(--muted)]">{courseSection.display_name}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
