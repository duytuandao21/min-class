import Link from "next/link";

import { CreateRoomForm } from "@/features/rooms/components/create-room-form";

export default function CreateRoomPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-12">
      <Link className="text-sm font-medium text-[var(--muted)] hover:text-[var(--accent)]" href="/">← MINCLASS</Link>
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">TEACHER · CREATE ROOM</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Tạo buổi học từ Markdown</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">Upload, kiểm tra preview, rồi lưu Room. Room mới luôn ở trạng thái DRAFT.</p>
      </header>
      <CreateRoomForm />
    </main>
  );
}
