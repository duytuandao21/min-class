import Link from "next/link";

export function BackLink({ className = "", href, label }: {
  className?: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      className={`group inline-flex min-h-10 w-fit items-center justify-center gap-2.5 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-bold leading-none text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${className}`}
      href={href}
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0 stroke-[2.75] text-[var(--accent)] transition-transform group-hover:-translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="inline-flex items-center leading-none">{label}</span>
    </Link>
  );
}
