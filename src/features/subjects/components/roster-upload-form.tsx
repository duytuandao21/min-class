"use client";

import type { ChangeEvent } from "react";
import { useActionState, useState } from "react";

import { saveCourseSectionRosterAction, type RosterActionState } from "@/features/subjects/roster-actions";
import {
  MAX_ROSTER_FILE_BYTES,
  parseRosterText,
  type RosterPreview,
} from "@/features/subjects/roster-parser";

const initialState: RosterActionState = { status: "idle" };

function rejectedPreview(message: string): RosterPreview {
  return {
    students: [],
    validCount: 0,
    emptyLineCount: 0,
    duplicates: [],
    invalidLines: [],
    fileErrors: [message],
    canSave: false,
  };
}

export function RosterUploadForm({
  subjectId,
  courseSectionId,
  currentCount,
}: {
  subjectId: string;
  courseSectionId: string;
  currentCount: number;
}) {
  const actionWithIds = saveCourseSectionRosterAction.bind(null, subjectId, courseSectionId);
  const [state, action, pending] = useActionState(actionWithIds, initialState);
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState("");
  const [reading, setReading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileName(file?.name ?? "");
    setSource("");
    setPreview(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setPreview(rejectedPreview("Chỉ chấp nhận file .txt."));
      return;
    }
    if (file.size > MAX_ROSTER_FILE_BYTES) {
      setPreview(rejectedPreview("File roster không được vượt quá 256 KB."));
      return;
    }

    setReading(true);
    try {
      const text = await file.text();
      setSource(text);
      setPreview(parseRosterText(text));
    } catch {
      setPreview(rejectedPreview("Không thể đọc file roster."));
    } finally {
      setReading(false);
    }
  }

  return (
    <form action={action} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Tải lên file MSSV</h2>
        </div>
        <span className="shrink-0 rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[var(--muted)]">
          {currentCount} hiện tại
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Mỗi dòng là một MSSV. Danh sách hợp lệ mới sẽ thay thế roster hiện tại.
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-emerald-900/25 bg-emerald-50/45 p-5">
        <label className="block font-semibold text-[#263129]" htmlFor="roster-file">Chọn file .txt</label>
        <p className="mt-1 text-xs text-[var(--muted)]">Tối đa 256 KB · một MSSV trên mỗi dòng</p>
        <input
          accept=".txt,text/plain"
          className="mt-4 block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2.5 file:font-semibold file:text-white hover:file:bg-emerald-800"
          id="roster-file"
          onChange={(event) => void handleFileChange(event)}
          type="file"
        />
      </div>
      <input name="fileName" type="hidden" value={fileName} />
      <textarea name="rosterSource" readOnly value={source} hidden />

      {reading ? <p className="mt-5 text-sm text-[var(--muted)]" role="status">Đang đọc file…</p> : null}
      {preview ? (
        <section className="mt-5 rounded-2xl border border-black/10 bg-black/[0.02] p-4" aria-labelledby="roster-preview-title">
          <h3 className="font-semibold" id="roster-preview-title">Kết quả kiểm tra</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><strong className="block text-2xl">{preview.validCount}</strong>Hợp lệ</p>
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong className="block text-2xl">{preview.duplicates.length}</strong>Trùng</p>
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong className="block text-2xl">{preview.invalidLines.length}</strong>Không hợp lệ</p>
          </div>
          {preview.fileErrors.map((message) => <p className="mt-4 text-sm font-semibold text-red-800" key={message} role="alert">{message}</p>)}
          {preview.duplicates.length > 0 ? (
            <div className="mt-5">
              <h4 className="text-sm font-semibold">Dòng trùng</h4>
              <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-sm text-amber-900">
                {preview.duplicates.map((duplicate) => <li key={`${duplicate.line}-${duplicate.mssv}`}>Dòng {duplicate.line}: {duplicate.mssv} trùng dòng {duplicate.firstLine}</li>)}
              </ul>
            </div>
          ) : null}
          {preview.invalidLines.length > 0 ? (
            <div className="mt-5">
              <h4 className="text-sm font-semibold">Dòng không hợp lệ</h4>
              <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-sm text-red-900">
                {preview.invalidLines.map((invalid) => <li key={`${invalid.line}-${invalid.value}`}>Dòng {invalid.line}: “{invalid.value}” — {invalid.reason}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {state.message ? (
        <p className={`mt-5 rounded-xl p-3 text-sm ${state.status === "success" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-6 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending || reading || !preview?.canSave}
        type="submit"
      >
        {pending ? "Đang lưu…" : currentCount > 0 ? "Lưu và thay thế danh sách" : "Lưu danh sách"}
      </button>
    </form>
  );
}
