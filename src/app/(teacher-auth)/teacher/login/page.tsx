import { redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { TeacherAuthForm } from "@/features/auth/components/teacher-auth-form";
import { getTeacherIdentity } from "@/features/auth/teacher-session";

export default async function TeacherLoginPage() {
  if (await getTeacherIdentity()) redirect("/teacher/subjects");

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-6 py-10 sm:px-10">
      <BackLink href="/" label="MINCLASS" />
      <section className="mt-10 rounded-3xl border border-black/10 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">TEACHER</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Đăng nhập</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">Đăng nhập để truy cập các Room do thầy quản lý.</p>
        <TeacherAuthForm />
      </section>
    </main>
  );
}
