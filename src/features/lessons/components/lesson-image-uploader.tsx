"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  createLessonImageMarkdown,
  getLessonImageLabel,
  type LessonImage,
  listLessonImages,
  uploadLessonImage,
  validateLessonImageInput,
} from "@/features/lessons/lesson-image";

function formatFileSize(size: number | null): string {
  if (size === null) return "Ảnh Lesson";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function LessonImageUploader({ disabled = false, subjectId }: {
  disabled?: boolean;
  subjectId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<LessonImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<LessonImage | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedImage) setSelectedImage(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedImage]);

  async function refreshImages() {
    setLoading(true);
    setError(null);
    try {
      setImages(await listLessonImages(subjectId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải thư viện ảnh.");
    } finally {
      setLoading(false);
    }
  }

  function openLibrary() {
    setOpen(true);
    setMessage(null);
    void refreshImages();
  }

  async function handleUpload() {
    if (!file) return setError("Hãy chọn một file ảnh.");
    const validation = validateLessonImageInput({ file, alt });
    if (!validation.ok) return setError(validation.errors.join(" "));

    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      await uploadLessonImage(subjectId, file, validation.alt);
      setFile(null);
      setAlt("");
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Đã upload ảnh. Bạn có thể sao chép nội dung Markdown ở danh sách bên dưới.");
      await refreshImages();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Không thể upload ảnh.");
    } finally {
      setUploading(false);
    }
  }

  async function copyMarkdown(image: LessonImage) {
    try {
      const markdown = createLessonImageMarkdown(image.url, getLessonImageLabel(image.name));
      await navigator.clipboard.writeText(markdown);
      setError(null);
      setMessage("Đã sao chép nội dung Markdown.");
    } catch {
      setMessage(null);
      setError("Không thể sao chép. Hãy cấp quyền Clipboard cho trình duyệt và thử lại.");
    }
  }

  return (
    <div className="mt-4">
      <button
        className="group flex w-full items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
        disabled={disabled}
        onClick={openLibrary}
        type="button"
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-200 transition-transform group-hover:scale-105 motion-reduce:transform-none">
          <svg className="size-5" fill="none" viewBox="0 0 24 24">
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="m5 17 4.1-4.1a1.5 1.5 0 0 1 2.1 0l1.3 1.3 1.7-1.7a1.5 1.5 0 0 1 2.1 0L20 16.2M15.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-sky-950">Thư viện ảnh Lesson</span>
          <span className="mt-0.5 block text-xs text-sky-900/65">Upload, xem trước và sao chép Markdown</span>
        </span>
        <span aria-hidden="true" className="text-lg font-bold text-sky-700">→</span>
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]">
          <section aria-labelledby="lesson-image-library-title" aria-modal="true" className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col rounded-3xl border border-sky-200 bg-[#f8fbfb] p-5 shadow-2xl sm:p-7" role="dialog">
            <button
              className="absolute right-5 top-5 min-h-11 rounded-xl border border-black/15 bg-white px-4 py-2 font-bold shadow-sm transition hover:bg-black/5 sm:right-7 sm:top-7"
              onClick={() => setOpen(false)}
              ref={closeRef}
              type="button"
            >
              Đóng
            </button>
            <header className="border-b border-black/10 pb-5 pr-24">
              <p className="text-xs font-bold tracking-[0.18em] text-sky-700">LESSON IMAGES</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl" id="lesson-image-library-title">Thư viện ảnh Lesson</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Upload ảnh, xem ảnh lớn hoặc sao chép cú pháp để dán vào file Markdown.</p>
            </header>

            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button className="rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-bold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50" disabled={uploading} onClick={() => inputRef.current?.click()} type="button">Chọn ảnh</button>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError(null);
                    setMessage(null);
                  }}
                  ref={inputRef}
                  type="file"
                />
                <p className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{file?.name ?? "PNG, JPEG hoặc WebP · tối đa 5 MB"}</p>
              </div>
              {file ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <label className="text-xs font-bold text-sky-950" htmlFor="lesson-image-alt">Mô tả ảnh</label>
                    <input className="mt-1.5 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15" id="lesson-image-alt" maxLength={200} onChange={(event) => setAlt(event.target.value)} placeholder="Ví dụ: Sơ đồ mô hình TCP/IP" value={alt} />
                  </div>
                  <button className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-800 disabled:opacity-50" disabled={uploading} onClick={() => void handleUpload()} type="button">{uploading ? "Đang upload…" : "Upload ảnh"}</button>
                </div>
              ) : null}
            </div>

            <div aria-live="polite">
              {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
              {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
            </div>

            <div className="mt-5 min-h-0 overflow-y-auto pr-1">
              {loading ? (
                <p className="rounded-2xl border border-dashed border-sky-200 bg-white p-10 text-center text-[var(--muted)]">Đang tải thư viện ảnh…</p>
              ) : images.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center text-[var(--muted)]">Chưa có ảnh nào. Hãy upload ảnh đầu tiên cho Lesson.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((image) => (
                    <li className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm" key={image.id}>
                      <button aria-label={`Xem ảnh ${getLessonImageLabel(image.name)}`} className="block aspect-[16/10] w-full overflow-hidden bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600" onClick={() => setSelectedImage(image)} type="button">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={getLessonImageLabel(image.name)} className="h-full w-full object-cover transition duration-200 hover:scale-[1.03] motion-reduce:transition-none" loading="lazy" src={image.url} />
                      </button>
                      <div className="p-4">
                        <p className="truncate text-sm font-bold" title={getLessonImageLabel(image.name)}>{getLessonImageLabel(image.name)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{formatFileSize(image.size)}</p>
                        <button className="mt-3 w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-800 transition hover:bg-sky-100" onClick={() => void copyMarkdown(image)} type="button">Copy nội dung MD</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {selectedImage ? (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onClick={() => setSelectedImage(null)}>
              <div aria-label={`Xem trước ${getLessonImageLabel(selectedImage.name)}`} aria-modal="true" className="relative max-h-[calc(100dvh-2rem)] max-w-6xl" onClick={(event) => event.stopPropagation()} role="dialog">
                <button aria-label="Đóng ảnh xem trước" className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-white text-xl font-black text-black shadow-lg" onClick={() => setSelectedImage(null)} type="button">×</button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={getLessonImageLabel(selectedImage.name)} className="max-h-[calc(100dvh-2rem)] max-w-full rounded-2xl object-contain shadow-2xl" src={selectedImage.url} />
              </div>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
