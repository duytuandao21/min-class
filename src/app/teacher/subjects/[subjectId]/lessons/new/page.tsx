import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LessonEditorForm } from "@/features/lessons/components/lesson-editor-form";
import { MarkdownWritingGuide } from "@/features/lessons/components/markdown-writing-guide";
import { getSubjectDetail } from "@/features/subjects/server/queries";

export default async function NewSubjectTemplateLessonPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const subject = await getSubjectDetail(subjectId);
  if (!subject) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={`/teacher/subjects/${subject.id}?lessonPlan=open`} label="Lesson Plan" />
      <header className="my-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">SUBJECT TEMPLATE</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Tạo Lesson mẫu</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">Lesson này sẽ được sao chép độc lập vào những lớp học phần tạo sau này.</p>
        </div>
        <MarkdownWritingGuide />
      </header>
      {subject.chapters.length === 0 ? (
        <p className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900">Hãy tạo chương trong Lesson Plan trước khi thêm Lesson mẫu.</p>
      ) : (
        <LessonEditorForm chapters={subject.chapters} mode="create-template" returnHref={`/teacher/subjects/${subject.id}?lessonPlan=open`} subjectId={subject.id} />
      )}
    </main>
  );
}
