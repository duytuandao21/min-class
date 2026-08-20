import Image from "next/image";
import Link from "next/link";

import backgroundImage from "../../picture/background.png";

export default function HomePage() {
  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden">
      <Image
        alt=""
        aria-hidden="true"
        className="-z-20 object-contain object-right-bottom opacity-25 sm:opacity-45 lg:opacity-100"
        fill
        placeholder="blur"
        priority
        sizes="100vw"
        src={backgroundImage}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/95 to-[var(--background)]/20 lg:via-[var(--background)]/80 lg:to-transparent" />

      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 lg:px-16">
        <div className="max-w-3xl">
          <p className="mb-6 text-sm font-bold tracking-[0.24em] text-[var(--accent)]">
            MINCLASS
          </p>
          <h1 className="max-w-4xl text-5xl leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-7xl">
            Học cùng Thầy Bảo
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            Học viên theo dõi bài học, làm quiz và thảo luận trực tiếp với giảng viên trong thời gian thực
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex rounded-xl bg-[#17201b] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent)]"
              href="/teacher/create"
            >
              Tạo Room
            </Link>
            <Link
              className="inline-flex rounded-xl border border-black/15 bg-white px-5 py-3 font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              href="/join"
            >
              Tham gia Room
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
