import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LessonEditorForm } from "@/features/lessons/components/lesson-editor-form";
import { MarkdownWritingGuide } from "@/features/lessons/components/markdown-writing-guide";
import { getTemplateLessonDetail } from "@/features/subjects/server/queries";

export default async function EditSubjectTemplateLessonPage({ params }: { params: Promise<{ subjectId: string; lessonId: string }> }) {
  const { subjectId, lessonId } = await params;
  const detail = await getTemplateLessonDetail(subjectId, lessonId);
  if (!detail) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={`/teacher/subjects/${detail.subject.id}?lessonPlan=open`} label="Lesson Plan" />
      <header className="my-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">EDIT SUBJECT TEMPLATE</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{detail.lesson.title}</h1>
          <p className="mt-4 text-[var(--muted)]">Thay đổi chỉ áp dụng cho mẫu và các lớp học phần tạo trong tương lai.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 font-bold text-sky-900" href={`/teacher/lessons/${detail.lesson.id}/download`}>Tải file .md</a>
          <MarkdownWritingGuide />
        </div>
      </header>
      <LessonEditorForm
        chapters={detail.subject.chapters}
        initial={{ id: detail.lesson.id, chapterId: detail.lesson.chapter_id, title: detail.lesson.title, markdownSource: detail.lesson.markdown_source }}
        mode="edit"
        returnHref={`/teacher/subjects/${detail.subject.id}?lessonPlan=open`}
        subjectId={detail.subject.id}
      />
    </main>
  );
}
