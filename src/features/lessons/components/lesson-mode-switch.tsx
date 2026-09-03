"use client";

export type LessonEditorMode = "edit" | "preview";

export function LessonModeSwitch({ disabled = false, mode, onChange }: {
  disabled?: boolean;
  mode: LessonEditorMode;
  onChange: (mode: LessonEditorMode) => void;
}) {
  return (
    <div
      aria-label="Chế độ chỉnh sửa Lesson"
      className="relative grid min-w-64 grid-cols-2 rounded-full border border-black/10 bg-[#e9eeeb] p-1.5 shadow-inner"
      role="group"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-1.5 w-[calc(50%-0.375rem)] rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-out motion-reduce:transition-none ${mode === "preview" ? "translate-x-[calc(100%+0.375rem)]" : "translate-x-0"}`}
      />
      <button
        aria-pressed={mode === "edit"}
        className={`relative z-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold transition-colors ${mode === "edit" ? "text-[var(--accent)]" : "text-slate-500"}`}
        disabled={disabled}
        onClick={() => onChange("edit")}
        type="button"
      >
        <span aria-hidden="true" className="text-lg">✎</span>
        Edit mode
      </button>
      <button
        aria-pressed={mode === "preview"}
        className={`relative z-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold transition-colors ${mode === "preview" ? "text-[var(--accent)]" : "text-slate-500"}`}
        disabled={disabled}
        onClick={() => onChange("preview")}
        type="button"
      >
        <span aria-hidden="true" className="text-lg">◉</span>
        Preview mode
      </button>
    </div>
  );
}
