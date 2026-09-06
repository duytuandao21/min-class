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
    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left">
      <input
        checked={checked}
        className="mt-1 size-5 accent-[var(--accent)]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>
        <strong className="block text-sm text-sky-950">Áp dụng thay đổi cho {courseSectionCount} lớp học phần hiện có</strong>
        <span className="mt-1 block text-xs leading-5 text-sky-800">
          Mặc định được bật. Bản Lesson đã có lịch sử buổi học hoặc đã được chỉnh sửa riêng sẽ được giữ nguyên.
        </span>
      </span>
    </label>
  );
}
