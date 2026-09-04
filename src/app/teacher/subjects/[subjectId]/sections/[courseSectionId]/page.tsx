import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { CreateLessonButton } from "@/features/lessons/components/create-lesson-button";
import { DeleteLessonButton } from "@/features/lessons/components/delete-lesson-button";
import { LessonChapterDisclosure } from "@/features/lessons/components/lesson-chapter-disclosure";
import { StartChapterSessionButton } from "@/features/lessons/components/start-chapter-session-button";
import { RosterStudentList } from "@/features/subjects/components/roster-student-list";
import { RosterUploadForm } from "@/features/subjects/components/roster-upload-form";
import { CourseSectionChapterButton } from "@/features/subjects/components/course-section-chapter-button";
import { DeleteCourseSectionChapterButton } from "@/features/subjects/components/delete-course-section-chapter-button";
import { getCourseSectionRosterDetail } from "@/features/subjects/server/queries";

export default async function CourseSectionRosterPage({
  params,
}: {
  params: Promise<{ subjectId: string; courseSectionId: string }>;
}) {
  const { subjectId, courseSectionId } = await params;
  const detail = await getCourseSectionRosterDetail(subjectId, courseSectionId);
  if (!detail) notFound();

  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const lessonsByChapter = new Map(detail.chapters.map((chapter) => [chapter.id, []] as [string, typeof detail.lessons]));
  for (const lesson of detail.lessons) lessonsByChapter.get(lesson.chapter_id)?.push(lesson);
  const activeChapterIndex = detail.chapters.findIndex((chapter) =>
    lessonsByChapter.get(chapter.id)?.some((lesson) => lesson.latestSession?.status === "ACTIVE"),
  );
  const initiallyOpenChapterIndex = activeChapterIndex >= 0 ? activeChapterIndex : 0;
  const createLessonHref = `/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}/lessons/new`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10">
      <BackLink href={`/teacher/subjects/${detail.subject.id}`} label={detail.subject.name} />
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">COURSE SECTION</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {detail.courseSection.section_code}
        </h1>
        {detail.courseSection.display_name ? (
          <p className="mt-3 text-lg text-[var(--muted)]">{detail.courseSection.display_name}</p>
        ) : null}
      </header>

      <section className="mb-10" aria-labelledby="lesson-list-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--muted)]">{detail.lessons.length} Lesson</p>
            <h2 className="mt-1 text-3xl font-semibold" id="lesson-list-title">Lessons</h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <CreateLessonButton baseHref={createLessonHref} chapters={detail.chapters} />
            <CourseSectionChapterButton courseSectionId={detail.courseSection.id} subjectId={detail.subject.id} />
            <a
              className="group inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 font-bold text-sky-900 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 motion-reduce:transform-none"
              href={`/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}/export`}
            >
              <svg
                aria-hidden="true"
                className="size-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
              </svg>
              Xuất dữ liệu
            </a>
          </div>
        </div>
        {detail.chapters.length === 0 ? (
          <p className="mt-5 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">
            Lesson Plan chưa có chương. Hãy thêm chương ở trang môn học trước khi tạo Lesson.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {detail.chapters.map((chapter, chapterIndex) => {
              const chapterLessons = lessonsByChapter.get(chapter.id) ?? [];
              const activeSession = chapterLessons.find((lesson) => lesson.latestSession?.status === "ACTIVE")?.latestSession ?? null;
              const hasSessionHistory = chapterLessons.some((lesson) => lesson.latestSession !== null);
              return (
                <LessonChapterDisclosure
                  actions={(
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {chapterLessons.length > 0 ? (
                        <>
                          {activeSession ? (
                            <Link className="inline-flex min-h-10 items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 motion-reduce:transform-none" href={`/teacher/rooms/${activeSession.id}`}>
                              Dashboard
                            </Link>
                          ) : (
                            <StartChapterSessionButton chapterId={chapter.id} courseSectionId={detail.courseSection.id} />
                          )}
                          {hasSessionHistory ? (
                            <Link
                              className="inline-flex min-h-10 items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100 hover:shadow-md motion-reduce:transform-none"
                              href={`/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}/chapters/${chapter.id}`}
                            >
                              Lịch sử
                            </Link>
                          ) : null}
                        </>
                      ) : null}
                      <DeleteCourseSectionChapterButton
                        chapterId={chapter.id}
                        chapterName={chapter.name}
                        courseSectionId={detail.courseSection.id}
                        subjectId={detail.subject.id}
                      />
                    </div>
                  )}
                  defaultOpen={chapterIndex === initiallyOpenChapterIndex}
                  key={chapter.id}
                  lessonCount={chapterLessons.length}
                  title={chapter.name}
                >
                  <div className="border-t border-black/10 bg-black/[0.015] p-3 sm:p-4">
                    {chapterLessons.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-[var(--muted)]">Chưa có Lesson trong chương này.</p>
                    ) : (
                      <ul className="space-y-3">
                        {chapterLessons.map((lesson) => (
                          <li className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between" key={lesson.id}>
                            <div className="min-w-0">
                              <h3 className="font-semibold">{lesson.title}</h3>
                              <p className="mt-1 text-xs text-[var(--muted)]">Created: {dateFormatter.format(new Date(lesson.created_at))}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                              <Link className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-800" href={`/teacher/subjects/${detail.subject.id}/sections/${detail.courseSection.id}/lessons/${lesson.id}/edit`}>
                                Sửa
                              </Link>
                              <DeleteLessonButton
                                courseSectionId={detail.courseSection.id}
                                lessonId={lesson.id}
                                lessonTitle={lesson.title}
                                subjectId={detail.subject.id}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </LessonChapterDisclosure>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-t border-black/10 pt-9" aria-labelledby="roster-management-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold" id="roster-management-title">Quản lý danh sách sinh viên</h2>
          </div>
          <p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">
            Sĩ số hiện tại: {detail.students.length}
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.35fr)]">
          <RosterUploadForm
            courseSectionId={detail.courseSection.id}
            currentCount={detail.students.length}
            subjectId={detail.subject.id}
          />
          <RosterStudentList students={detail.students} />
        </div>
      </section>
    </main>
  );
}
