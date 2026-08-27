import { notFound } from "next/navigation";

import { StudentLessonPlayer } from "@/features/rooms/components/student-lesson-player";
import { getStudentRoom } from "@/features/rooms/server/queries";

export default async function StudentRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = await getStudentRoom(roomId);
  if (!room) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10 sm:px-10">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-black/10 pb-6 sm:flex-row">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">MINCLASS · {room.code}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{room.title}</h1>
        </div>
        <span className="max-w-full break-all rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">Đã tham gia · {room.mssv}</span>
      </header>

      <StudentLessonPlayer
        initialReactions={room.reactions}
        initialSessionReflection={room.sessionReflection}
        initialSnapshot={{
          id: room.id,
          code: room.code,
          title: room.title,
          status: room.status,
          releasedThrough: room.releasedThrough,
          sections: room.sections,
        }}
      />
    </main>
  );
}
