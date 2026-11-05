import { useEffect, useState } from "react";
import { BackLink } from "../../src/components/back-link";
import { LessonChapterDisclosure } from "../../src/features/lessons/components/lesson-chapter-disclosure";
import { StartChapterSessionButton } from "../../src/features/lessons/components/start-chapter-session-button";
import { ActiveChapterSessions } from "../../src/features/rooms/components/active-chapter-sessions";
import { EndSessionButton } from "../../src/features/rooms/components/end-session-button";
import { ReleaseChapterButton } from "../../src/features/rooms/components/release-chapter-button";
import { PublicLiveSessions } from "../../src/features/catalog/components/public-live-sessions";
import { chapters, courseSectionId, readChapterState } from "./mock-chapter-actions.mjs";

export function MultiChapterHarness() {
  const [state, setState] = useState(readChapterState);
  const [route, setRoute] = useState("course");
  const [roomId, setRoomId] = useState(null);
  const isStudent = new URLSearchParams(location.search).has("student");
  useEffect(() => {
    const update = () => setState(readChapterState());
    const navigate = (event) => {
      const match = event.detail.match(/\/teacher\/rooms\/([^/]+)(\/summary)?/);
      setRoomId(match?.[1] ?? null);
      setRoute(match ? match[2] ? "summary" : "dashboard" : "course");
      update();
    };
    window.addEventListener("chapter:update", update);
    window.addEventListener("test:refresh", update);
    window.addEventListener("test:navigate", navigate);
    return () => {
      window.removeEventListener("chapter:update", update);
      window.removeEventListener("test:refresh", update);
      window.removeEventListener("test:navigate", navigate);
    };
  }, []);
  const active = state.sessions.filter((session) => session.status === "ACTIVE");
  const current = state.sessions.find((session) => session.id === roomId);
  if (isStudent) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-8 text-4xl font-semibold">Các bài học đang live</h1>
        <PublicLiveSessions sessions={active.map((session) => ({
          session_id: session.id, chapter_name: session.title, section_code: "MULTI01",
          subject_name: "Môn học", section_display_name: null,
          first_lesson_id: session.chapterId, lesson_count: 2, started_at: session.started_at,
        }))} />
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      {route !== "course" ? <BackLink href="/teacher/subjects/subject/sections/course" label="Course Section" /> : null}
      <h1 className="my-8 break-words text-3xl font-semibold">{route === "course" ? "MULTI01" : route === "summary" ? `Tổng kết ${current.title}` : current.title}</h1>
      {route === "summary" ? null : <ActiveChapterSessions currentSessionId={roomId} sessions={active} />}
      {route === "course" ? (
        <section className="space-y-4">
          <h2 className="text-3xl font-semibold">Lessons</h2>
          {chapters.map((chapter) => (
            <LessonChapterDisclosure key={chapter.id} title={chapter.name} lessonCount={2} subtitle="2 Lessons" showLessonCount={false}
              actions={active.some((session) => session.chapterId === chapter.id) ? (
                <span className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white">Dashboard</span>
              ) : <StartChapterSessionButton chapterId={chapter.id} chapterName={chapter.name} courseSectionId={courseSectionId} />}>
              <p className="p-5">Nội dung Lesson</p>
            </LessonChapterDisclosure>
          ))}
        </section>
      ) : route === "dashboard" ? (
        <div className="flex flex-wrap gap-3">
          <ReleaseChapterButton chapterName={current.title} roomId={current.id} />
          <EndSessionButton chapterName={current.title} roomId={current.id} />
        </div>
      ) : null}
    </main>
  );
}
