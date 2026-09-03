import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import {
  CourseSectionEditor,
  CreateCourseSectionForm,
  EditSubjectForm,
} from "@/features/subjects/components/management-forms";
import { LessonPlanManager } from "@/features/subjects/components/lesson-plan-manager";
import { getSubjectDetail } from "@/features/subjects/server/queries";

export default async function SubjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ lessonPlan?: string | string[] }>;
}) {
  const { subjectId } = await params;
  const query = await searchParams;
  const subject = await getSubjectDetail(subjectId);
  if (!subject) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <BackLink href="/teacher/subjects" label="Môn học" />
      <header className="my-10">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">SUBJECT DETAIL</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">{subject.name}</h1>
            {subject.code ? <p className="mt-3 font-semibold text-[var(--muted)]">{subject.code}</p> : null}
          </div>
          <EditSubjectForm subject={subject} />
        </div>
      </header>
      <section aria-labelledby="course-section-title">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold" id="course-section-title">Lớp học phần</h2>
            <div className="flex flex-wrap justify-end gap-3">
              <CreateCourseSectionForm hasTemplateLessons={subject.templateLessons.length > 0} subjectId={subject.id} />
              <LessonPlanManager
                chapters={subject.chapters}
                defaultOpen={query.lessonPlan === "setup" || query.lessonPlan === "open"}
                subjectId={subject.id}
                templateLessons={subject.templateLessons}
              />
            </div>
          </div>
          {subject.templateLessons.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
              Hoàn thiện Lesson Plan với ít nhất một Lesson mẫu trước khi tạo lớp học phần.
            </p>
          ) : null}
          {subject.courseSections.length === 0 ? (
            <p className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Chưa có lớp học phần.</p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {subject.courseSections.map((courseSection) => <CourseSectionEditor courseSection={courseSection} key={courseSection.id} />)}
            </div>
          )}
      </section>
    </main>
  );
}
