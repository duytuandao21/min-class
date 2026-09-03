import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LessonEditorForm } from "@/features/lessons/components/lesson-editor-form";
import { MarkdownWritingGuide } from "@/features/lessons/components/markdown-writing-guide";
import { getCourseSectionRosterDetail, getPersistentLessonDetail } from "@/features/subjects/server/queries";

export default async function EditCourseLessonPage({ params }: {
  params: Promise<{ subjectId: string; courseSectionId: string; lessonId: string }>;
}) {
  const { subjectId, courseSectionId, lessonId } = await params;
  const [detail, course] = await Promise.all([
    getPersistentLessonDetail(subjectId, courseSectionId, lessonId),
    getCourseSectionRosterDetail(subjectId, courseSectionId),
  ]);
  if (!detail || !course) notFound();
  const returnHref = `/teacher/subjects/${subjectId}/sections/${courseSectionId}/lessons/${lessonId}`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={returnHref} label={detail.lesson.title} />
      <header className="my-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">COURSE LESSON</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Chỉnh sửa Lesson</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">Đây là bản riêng của lớp {course.courseSection.section_code}; Lesson mẫu của môn học không thay đổi.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 font-bold text-sky-900" href={`/teacher/lessons/${lessonId}/download`}>Tải file .md</a>
          <MarkdownWritingGuide />
        </div>
      </header>
      {detail.sessions.length > 0 ? (
        <p className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900">Lesson đã có Session nên nội dung được khóa để bảo toàn lịch sử buổi học.</p>
      ) : (
        <LessonEditorForm
          chapters={course.chapters}
          initial={{ id: lessonId, chapterId: detail.lesson.chapter_id, title: detail.lesson.title, markdownSource: detail.lesson.markdown_source }}
          mode="edit"
          returnHref={returnHref}
          subjectId={subjectId}
        />
      )}
    </main>
  );
}
