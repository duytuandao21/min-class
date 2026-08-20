import { BackLink } from "@/components/back-link";
import { JoinRoomForm } from "@/features/rooms/components/join-room-form";

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <BackLink className="mb-10" href="/" label="MINCLASS" />
      <header className="mb-8">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">STUDENT · JOIN ROOM</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Tham gia buổi học</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">Nhập Room Code và MSSV được dùng cho buổi học này.</p>
      </header>
      <JoinRoomForm />
    </main>
  );
}
