import { BackLink } from "@/components/back-link";
import { PublicLiveSessions } from "@/features/catalog/components/public-live-sessions";
import { getPublicLiveSessions } from "@/features/catalog/server/queries";

export default async function PublicLiveSessionsPage() {
  const sessions = await getPublicLiveSessions();
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <BackLink href="/" label="MINCLASS" />
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">ĐANG DIỄN RA</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Các bài học đang live</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">Một lớp có thể có nhiều chương đang LIVE. Chọn đúng lớp và chương, sau đó nhập MSSV để tham gia toàn bộ Lesson trong chương đó.</p>
      </header>

      <PublicLiveSessions sessions={sessions} />
    </main>
  );
}
