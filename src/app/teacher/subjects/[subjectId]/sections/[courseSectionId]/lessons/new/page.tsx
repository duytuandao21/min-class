import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { CreateCourseSectionLessonForm } from "@/features/lessons/components/create-course-section-lesson-form";
import { MarkdownWritingGuide } from "@/features/lessons/components/markdown-writing-guide";
import { getCourseSectionRosterDetail } from "@/features/subjects/server/queries";
import { chapterIdSchema } from "@/features/subjects/schemas";

export default async function NewCourseSectionLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string; courseSectionId: string }>;
  searchParams: Promise<{ chapterId?: string | string[] }>;
}) {
  const { subjectId, courseSectionId } = await params;
  const query = await searchParams;
  const detail = await getCourseSectionRosterDetail(subjectId, courseSectionId);
  if (!detail) notFound();

  const chapterId = chapterIdSchema.safeParse(query.chapterId);
  const chapter = chapterId.success ? detail.chapters.find((item) => item.id === chapterId.data) : null;
  if (!chapter) redirect(`/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}`);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink
        href={`/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}`}
        label={detail.courseSection.section_code}
      />
      <header className="my-10 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">CREATE PERSISTENT LESSON</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Tạo Lesson</h1>
          <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
            Upload, preview và lưu Lesson vào <strong>{chapter.name}</strong>.
            <br /> Lesson chưa LIVE sau khi tạo.
          </p>
        </div>
        <MarkdownWritingGuide />
      </header>
      <CreateCourseSectionLessonForm chapter={chapter} courseSectionId={detail.courseSection.id} subjectId={detail.subject.id} />
    </main>
  );
}
