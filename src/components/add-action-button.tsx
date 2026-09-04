export const addActionButtonClassName = "group inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl border border-emerald-950/15 bg-[var(--accent)] px-4 py-2.5 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-950/25 hover:bg-emerald-800 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transform-none";

export function AddActionIcon({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`${compact ? "size-5 bg-emerald-200 text-emerald-800 group-hover:bg-emerald-300" : "size-6 bg-[#4da878] text-white group-hover:bg-[#62b78a]"} flex shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/20 transition-transform group-hover:rotate-90 motion-reduce:transform-none`}
    >
      <svg className={compact ? "size-3" : "size-3.5"} fill="none" viewBox="0 0 16 16">
        <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" />
      </svg>
    </span>
  );
}
