"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { MarkdownPreview } from "@/features/lessons/components/markdown-preview";
import {
  previewLessonAction,
  saveRoomAction,
  type PreviewLessonResult,
  type SaveRoomResult,
} from "@/features/rooms/actions";

type Preview = Extract<PreviewLessonResult, { ok: true }>;
type CreatedRoom = Extract<SaveRoomResult, { ok: true }>["room"];

export function CreateRoomForm() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [createdRoom, setCreatedRoom] = useState<CreatedRoom | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPreviewing, startPreview] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function invalidatePreview() {
    setPreview(null);
    setErrors([]);
  }

  function handlePreview(formData: FormData) {
    setErrors([]);
    startPreview(async () => {
      const result = await previewLessonAction(formData);
      if (!result.ok) {
        setPreview(null);
        setErrors(result.errors);
        return;
      }
      setPreview(result);
    });
  }

  function handleSave() {
    if (!preview) return;
    setErrors([]);
    startSaving(async () => {
      const result = await saveRoomAction({
        roomTitle: preview.roomTitle,
        markdownSource: preview.markdownSource,
      });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setCreatedRoom(result.room);
    });
  }

  if (createdRoom) {
    return (
      <section className="rounded-3xl border border-emerald-900/10 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-bold tracking-[0.16em] text-[var(--accent)]">ROOM ĐÃ TẠO</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{createdRoom.title}</h2>
        <p className="mt-7 text-sm text-[var(--muted)]">Room Code</p>
        <p className="mt-1 font-mono text-5xl font-bold tracking-[0.16em] text-[var(--accent)]">{createdRoom.code}</p>
        <p className="mt-6 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
          {createdRoom.status}
        </p>
        <div className="mt-8">
          <Link
            className="inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition hover:bg-emerald-800"
            href={`/teacher/rooms/${createdRoom.id}`}
          >
            Quản lý và Start Room
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <form
        className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm lg:sticky lg:top-8"
        onSubmit={(event) => {
          event.preventDefault();
          handlePreview(new FormData(event.currentTarget));
        }}
      >
        <div>
          <label className="text-sm font-semibold" htmlFor="roomTitle">Tên buổi học</label>
          <input
            className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-emerald-700/15"
            id="roomTitle"
            maxLength={120}
            name="roomTitle"
            onChange={invalidatePreview}
            placeholder="Ví dụ: TCP Three-Way Handshake"
            required
          />
        </div>
        <div className="mt-5">
          <label className="text-sm font-semibold" htmlFor="lessonFile">Lesson Markdown</label>
          <input
            accept=".md,text/markdown,text/plain"
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900/8 file:px-3 file:py-2 file:font-semibold file:text-[var(--accent)]"
            id="lessonFile"
            name="lessonFile"
            onChange={invalidatePreview}
            required
            type="file"
          />
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">File .md, tối đa 1 MB. Bạn phải preview trước khi lưu.</p>
        </div>

        {errors.length ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p className="font-semibold">Không thể tiếp tục:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        ) : null}

        <button
          className="mt-6 w-full rounded-xl bg-[#17201b] px-4 py-3 font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPreviewing || isSaving}
          type="submit"
        >
          {isPreviewing ? "Đang parse…" : preview ? "Preview lại" : "Parse & Preview"}
        </button>
        {preview ? (
          <button
            className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || isPreviewing}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Đang lưu…" : "Save Room ở trạng thái DRAFT"}
          </button>
        ) : null}
      </form>

      <div>
        {preview ? (
          <>
            <p className="mb-4 text-sm text-[var(--muted)]">Preview từ <span className="font-medium text-[var(--foreground)]">{preview.fileName}</span></p>
            <MarkdownPreview lesson={preview.lesson} />
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-black/20 px-8 text-center text-sm leading-6 text-[var(--muted)]">
            Preview lesson sẽ xuất hiện ở đây sau khi file được parse và validate.
          </div>
        )}
      </div>
    </div>
  );
}
