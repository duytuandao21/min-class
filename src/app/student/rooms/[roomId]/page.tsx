import { notFound } from "next/navigation";

import { StudentLessonPlayer } from "@/features/rooms/components/student-lesson-player";
import { getStudentRoom } from "@/features/rooms/server/queries";

export default async function StudentRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = await getStudentRoom(roomId);
  if (!room) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-black/10 pb-8 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">MINCLASS · LESSON {room.status === "ACTIVE" ? "LIVE" : "REVIEW"}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{room.title}</h1>
        </div>
        <span className="max-w-full break-all rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">Đã tham gia · {room.mssv}</span>
      </header>

      <StudentLessonPlayer
        initialReactions={room.reactions}
        initialSessionReflection={room.sessionReflection}
        initialSnapshot={{
          id: room.id,
          title: room.title,
          status: room.status,
          releasedThrough: room.releasedThrough,
          sections: room.sections,
        }}
      />
    </main>
  );
}
