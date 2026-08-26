"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const frontmatterExample = [
  "---",
  "title: Tên bài học",
  "description: Mô tả ngắn về bài học.",
  "---",
].join("\n");

const contentExample = [
  ":::section",
  "id: tcp-overview",
  "title: Tổng quan về TCP",
  "type: content",
  "",
  "## Tiêu đề nội dung",
  "",
  "Đoạn văn có **chữ đậm**, *chữ nghiêng* và `inline code`.",
  "",
  "- Danh sách không thứ tự",
  "- Mục thứ hai",
  "",
  "1. Danh sách có thứ tự",
  "2. Bước tiếp theo",
  "",
  "[Đọc thêm](https://example.com)",
  "",
  "![Mô tả ảnh](https://example.com/image.png)",
  "",
  "```text",
  "SYN -> SYN-ACK -> ACK",
  "```",
  ":::",
].join("\n");

const reflectionExample = [
  ":::section",
  "id: pause-and-reflect",
  "title: Dừng lại và suy ngẫm",
  "type: reflection",
  "",
  "Hãy giải thích lại ý chính bằng một câu.",
  ":::",
].join("\n");

const quizExample = [
  ":::quiz",
  "id: knowledge-check",
  "title: Kiểm tra kiến thức",
  "questions:",
  "  - id: single-question",
  "    type: single_choice",
  "    text: Đâu là đáp án đúng?",
  "    options:",
  "      - id: option-a",
  "        text: Đáp án A",
  "        correct: true",
  "      - id: option-b",
  "        text: Đáp án B",
  "        correct: false",
  "",
  "  - id: multiple-question",
  "    type: multiple_choice",
  "    text: Chọn tất cả đáp án đúng.",
  "    options:",
  "      - id: choice-a",
  "        text: Lựa chọn A",
  "        correct: true",
  "      - id: choice-b",
  "        text: Lựa chọn B",
  "        correct: true",
  "      - id: choice-c",
  "        text: Lựa chọn C",
  "        correct: false",
  "",
  "  - id: true-false-question",
  "    type: true_false",
  "    text: TCP là giao thức hướng kết nối.",
  "    options:",
  "      - id: answer-true",
  "        text: Đúng",
  "        correct: true",
  "      - id: answer-false",
  "        text: Sai",
  "        correct: false",
  ":::",
].join("\n");

function GuideSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-[var(--accent)]">{title}</h3>
      <div className="mt-3 text-sm leading-7 text-[#39453d]">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-xl bg-[#17201b] p-4 text-xs leading-6 text-[#edf7f0] sm:text-sm">
      <code>{children}</code>
    </pre>
  );
}

export function MarkdownWritingGuide() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function closeGuide() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="shrink-0">
      <button
        className="rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-emerald-800"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Cách viết file lesson
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]">
          <div aria-labelledby="markdown-guide-title" aria-modal="true" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-emerald-200 bg-[#f7faf7] shadow-2xl" role="dialog">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 bg-white px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[var(--accent)]">MINCLASS MARKDOWN</p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl" id="markdown-guide-title">Cách viết file Lesson</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">File <code>.md</code>, tối đa 1 MB. Nội dung phải nằm trong section hoặc quiz.</p>
              </div>
              <button className="min-h-11 rounded-xl border border-black/20 bg-white px-5 py-2.5 font-bold shadow-sm transition hover:bg-black/5" onClick={closeGuide} ref={closeRef} type="button">Đóng</button>
            </header>

            <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
              <div className="grid gap-5 lg:grid-cols-2">
                <GuideSection title="1. Frontmatter bắt buộc">
                  <p>File phải bắt đầu bằng <code>---</code>. <strong>title</strong> là bắt buộc; <strong>description</strong> có thể bỏ qua.</p>
                  <CodeBlock>{frontmatterExample}</CodeBlock>
                </GuideSection>

                <GuideSection title="2. Quy tắc ID">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Dài từ 1–64 ký tự; nên dùng chữ thường, số, dấu <code>-</code> hoặc <code>_</code>.</li>
                    <li>ID Section không được trùng trong toàn Lesson.</li>
                    <li>ID câu hỏi không được trùng trong cùng Quiz.</li>
                    <li>ID đáp án không được trùng trong cùng câu hỏi.</li>
                    <li>ID câu hỏi và đáp án có thể bỏ qua để MINCLASS tự tạo, nhưng nên khai báo rõ.</li>
                  </ul>
                </GuideSection>

                <div className="lg:col-span-2">
                  <GuideSection title="3. Section nội dung và Markdown được hỗ trợ">
                    <p>Dùng <code>:::section</code> và kết thúc bằng <code>:::</code>. Sau metadata phải có một dòng trống trước nội dung.</p>
                    <p className="mt-2">Hỗ trợ paragraph, heading, <strong>bold</strong>, <em>italic</em>, danh sách có/không thứ tự, link, ảnh URL, inline code, xuống dòng và fenced code block.</p>
                    <CodeBlock>{contentExample}</CodeBlock>
                  </GuideSection>
                </div>

                <GuideSection title="4. Reflection Section">
                  <p>Reflection dùng cùng cú pháp Section nhưng đặt <code>type: reflection</code>. Nội dung không được để trống.</p>
                  <CodeBlock>{reflectionExample}</CodeBlock>
                </GuideSection>

                <GuideSection title="5. URL và nội dung an toàn">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Link chỉ nhận <code>http</code>, <code>https</code> hoặc anchor dạng <code>#muc</code>.</li>
                    <li>Ảnh phải là URL <code>http</code> hoặc <code>https</code>.</li>
                    <li>Không hỗ trợ HTML tùy ý, iframe, video, slide hoặc assignment.</li>
                    <li>Không đặt văn bản bên ngoài <code>:::section</code> hay <code>:::quiz</code>.</li>
                  </ul>
                </GuideSection>

                <div className="lg:col-span-2">
                  <GuideSection title="6. Quiz: Single Choice, Multiple Choice và True/False">
                    <ul className="list-disc space-y-1 pl-5">
                      <li><code>single_choice</code> hoặc <code>single</code>: đúng một đáp án có <code>correct: true</code>.</li>
                      <li><code>multiple_choice</code> hoặc <code>multiple</code>: ít nhất một đáp án đúng.</li>
                      <li><code>true_false</code>: đúng hai lựa chọn và đúng một đáp án đúng.</li>
                      <li>Mỗi câu hỏi phải có ít nhất hai lựa chọn; nội dung đáp án không được để trống.</li>
                      <li>Dùng <code>questions</code> cho nhiều câu. Quiz một câu cũng có thể dùng <code>question</code> kèm <code>options</code>.</li>
                    </ul>
                    <CodeBlock>{quizExample}</CodeBlock>
                  </GuideSection>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950 lg:col-span-2">
                  <strong>Lưu ý:</strong> Mỗi Lesson cần ít nhất một Section. Hãy dùng nút <strong>Parse &amp; Preview</strong> để kiểm tra toàn bộ ID, YAML, Markdown và Quiz trước khi lưu.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
