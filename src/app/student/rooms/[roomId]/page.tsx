import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { StudentLessonPlayer } from "@/features/rooms/components/student-lesson-player";
import { getStudentRoom } from "@/features/rooms/server/queries";

export default async function StudentRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ lessonId?: string }>;
}) {
  const { roomId } = await params;
  const { lessonId } = await searchParams;
  const room = await getStudentRoom(roomId, lessonId);
  if (!room) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href="/" label="Trang chủ MINCLASS" />

      <header className="mt-8 flex flex-col items-start justify-between gap-5 border-b border-black/10 pb-8 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">MINCLASS · LESSON {room.status === "ACTIVE" ? "LIVE" : "REVIEW"}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{room.title}</h1>
        </div>
        <span className="max-w-full break-all rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">Đã tham gia · {room.mssv}</span>
      </header>

      <nav aria-label="Các Lesson trong buổi học" className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {room.lessons.map((lesson) => (
          <Link
            aria-current={lesson.lesson_id === room.selectedLessonId ? "page" : undefined}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${lesson.lesson_id === room.selectedLessonId ? "border-emerald-700 bg-emerald-700 text-white" : "border-black/10 bg-white hover:border-emerald-400 hover:text-[var(--accent)]"}`}
            href={`/student/rooms/${room.id}?lessonId=${lesson.lesson_id}`}
            key={lesson.lesson_id}
          >
            {lesson.lesson_title}
          </Link>
        ))}
      </nav>

      <StudentLessonPlayer
        key={room.selectedLessonId}
        initialReactions={room.reactions}
        initialSessionReflection={room.sessionReflection}
        initialSnapshot={{
          id: room.id,
          title: room.title,
          status: room.status,
          releasedThrough: room.releasedThrough,
          sections: room.sections,
        }}
        lessonId={room.selectedLessonId}
      />
    </main>
  );
}
