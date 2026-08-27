import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { SessionReviewsViewer } from "@/features/rooms/components/session-reviews-viewer";
import { getTeacherSessionReflections } from "@/features/rooms/server/queries";

export default async function SessionReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ present?: string }>;
}) {
  const { roomId } = await params;
  const { present } = await searchParams;
  const snapshot = await getTeacherSessionReflections(roomId);
  if (!snapshot) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={`/teacher/rooms/${snapshot.roomId}/summary`} label="Summary" />
      <header className="mt-10 max-w-4xl border-b border-black/10 pb-8">
        <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">SESSION REVIEWS</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Điều lớp học mang theo sau buổi học</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">{snapshot.roomTitle}</p>
      </header>
      <section className="mt-8">
        <SessionReviewsViewer initialPresentation={present === "1"} snapshot={snapshot} />
      </section>
    </main>
  );
}
