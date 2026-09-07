"use client";

export function TemplateSyncChoice({
  checked,
  courseSectionCount,
  onChange,
}: {
  checked: boolean;
  courseSectionCount: number;
  onChange: (checked: boolean) => void;
}) {
  if (courseSectionCount === 0) return null;

  return (
    <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left">
      <input
        checked={checked}
        className="peer sr-only"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-sky-400 bg-white text-white shadow-inner transition peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
      >
        <svg className={`size-3 transition-opacity ${checked ? "opacity-100" : "opacity-0"}`} fill="none" viewBox="0 0 16 16">
          <path d="m3.5 8.25 2.75 2.75 6.25-6.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
        </svg>
      </span>
      <strong className="block text-sm text-sky-950">Áp dụng thay đổi cho {courseSectionCount} lớp học phần hiện có</strong>
    </label>
  );
}
