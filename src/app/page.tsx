import Link from "next/link";

const principles = [
  "Theo sát từng phần của bài học",
  "Phản hồi ngay tại điểm kiến thức",
  "Giúp giảng viên hiểu tình hình lớp",
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 sm:px-10 lg:px-16">
      <section className="grid w-full gap-14 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div>
          <p className="mb-6 text-sm font-bold tracking-[0.24em] text-[var(--accent)]">
            MINCLASS
          </p>
          <h1 className="max-w-4xl text-5xl leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-7xl">
            Một nhịp học chung cho cả lớp.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            Classroom companion tối giản cho lớp học trực tiếp, nơi nội dung và phản hồi
            cùng đi theo flow của giảng viên.
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

        <ul className="space-y-3" aria-label="Giá trị cốt lõi">
          {principles.map((principle, index) => (
            <li
              className="flex items-start gap-4 border-t border-black/10 py-4 text-base leading-7"
              key={principle}
            >
              <span className="mt-0.5 font-mono text-xs text-[var(--accent)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{principle}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
