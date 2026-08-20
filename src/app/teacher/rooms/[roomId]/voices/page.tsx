import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassVoicesViewer } from "@/features/rooms/components/class-voices-viewer";
import { getTeacherClassVoices } from "@/features/rooms/server/queries";

export default async function ClassVoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ present?: string }>;
}) {
  const { roomId } = await params;
  const { present } = await searchParams;
  const snapshot = await getTeacherClassVoices(roomId);
  if (!snapshot) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <Link className="text-sm font-medium text-[var(--muted)] hover:text-[var(--accent)]" href={`/teacher/rooms/${snapshot.roomId}/summary`}>← Summary</Link>
      <header className="mt-10 max-w-4xl border-b border-black/10 pb-8">
        <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">CLASS VOICES - {snapshot.roomCode}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Những điều lớp học muốn nói</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">{snapshot.roomTitle}</p>
      </header>
      <section className="mt-8">
        <ClassVoicesViewer initialPresentation={present === "1"} snapshot={snapshot} />
      </section>
    </main>
  );
}
