import Link from "next/link";

export function BackLink({ className = "", href, label }: {
  className?: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      className={`group inline-flex w-fit items-center gap-2.5 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-bold text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${className}`}
      href={href}
    >
      <span
        aria-hidden="true"
        className="text-2xl leading-none font-black text-[var(--accent)] transition-transform group-hover:-translate-x-0.5"
      >
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}
