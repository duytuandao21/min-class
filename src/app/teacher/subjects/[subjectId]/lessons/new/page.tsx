import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { CreateSubjectTemplateLessonsForm } from "@/features/lessons/components/create-course-section-lesson-form";
import { MarkdownWritingGuide } from "@/features/lessons/components/markdown-writing-guide";
import { chapterIdSchema } from "@/features/subjects/schemas";
import { getSubjectChapterContext } from "@/features/subjects/server/queries";

export default async function NewSubjectTemplateLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ chapterId?: string | string[] }>;
}) {
  const { subjectId } = await params;
  const query = await searchParams;
  const chapterId = chapterIdSchema.safeParse(query.chapterId);
  if (!chapterId.success) redirect(`/teacher/subjects/${subjectId}?lessonPlan=open`);
  const context = await getSubjectChapterContext(subjectId, chapterId.data);
  if (!context) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={`/teacher/subjects/${context.subject.id}?lessonPlan=open`} label="Lesson Plan" />
      <header className="my-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">SUBJECT TEMPLATE</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Tạo Lesson mẫu</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            Upload, chỉnh sửa, preview và lưu nhiều Lesson mẫu vào <strong>{context.chapter.name}</strong>.
          </p>
        </div>
        <MarkdownWritingGuide />
      </header>
      <CreateSubjectTemplateLessonsForm
        chapter={context.chapter}
        courseSectionCount={context.courseSectionCount}
        subjectId={context.subject.id}
      />
    </main>
  );
}
