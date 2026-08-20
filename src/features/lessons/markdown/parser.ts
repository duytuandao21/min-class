import type { Nodes, Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import {
  normalizedLessonSchema,
  type NormalizedLesson,
  type NormalizedLessonSection,
  type NormalizedQuizQuestion,
} from "./schema";

const MAX_MARKDOWN_BYTES = 1_048_576;
const ALLOWED_MARKDOWN_NODES = new Set<Nodes["type"]>([
  "root",
  "paragraph",
  "text",
  "heading",
  "strong",
  "emphasis",
  "list",
  "listItem",
  "link",
  "image",
  "inlineCode",
  "code",
  "break",
]);

const frontmatterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
});

const contentHeaderSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  type: z.enum(["content", "reflection"]).default("content"),
});

const quizOptionInputSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  text: z.string().trim().min(1).max(500),
  correct: z.boolean(),
});

const quizQuestionInputSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  type: z.enum(["single", "single_choice", "multiple", "multiple_choice", "true_false"]),
  text: z.string().trim().min(1).max(1000),
  options: z.array(quizOptionInputSchema).min(2).optional(),
});

const quizInputSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    question: quizQuestionInputSchema.optional(),
    questions: z.array(quizQuestionInputSchema).min(1).optional(),
    options: z.array(quizOptionInputSchema).min(2).optional(),
  })
  .superRefine((value, context) => {
    if (value.question && value.questions) {
      context.addIssue({ code: "custom", message: "chỉ dùng question hoặc questions, không dùng cả hai" });
    }
    if (!value.question && !value.questions) {
      context.addIssue({ code: "custom", message: "quiz phải có question hoặc questions" });
    }
    if (value.options && !value.question) {
      context.addIssue({ code: "custom", message: "options cấp quiz chỉ dùng cùng question" });
    }
    if (value.question && !value.options && !value.question.options) {
      context.addIssue({ code: "custom", message: "question phải có options" });
    }
    value.questions?.forEach((question, index) => {
      if (!question.options) {
        context.addIssue({ code: "custom", path: ["questions", index, "options"], message: "bắt buộc" });
      }
    });
  });

type Directive = { kind: "section" | "quiz"; body: string; line: number };

export class MarkdownValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "MarkdownValidationError";
    this.issues = issues;
  }
}

function formatZodError(context: string, error: z.ZodError): MarkdownValidationError {
  return new MarkdownValidationError(
    error.issues.map((issue) => `${context}${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`),
  );
}

function parseYamlObject(source: string, context: string): unknown {
  try {
    const parsed: unknown = parseYaml(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new MarkdownValidationError([`${context}: phải là một YAML object`]);
    }
    return parsed;
  } catch (error) {
    if (error instanceof MarkdownValidationError) throw error;
    throw new MarkdownValidationError([`${context}: YAML không hợp lệ`]);
  }
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase();
}

function assertSafeUrl(url: string, label: string): void {
  if (url.startsWith("#")) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return;
  } catch {
    // Fall through to the validation error below.
  }
  throw new MarkdownValidationError([`${label}: URL chỉ được dùng http, https hoặc anchor`]);
}

function validateMarkdown(source: string, context: string): void {
  let tree: Root;
  try {
    tree = unified().use(remarkParse).parse(source) as Root;
  } catch {
    throw new MarkdownValidationError([`${context}: Markdown không hợp lệ`]);
  }

  const issues: string[] = [];
  visit(tree, (node) => {
    if (!ALLOWED_MARKDOWN_NODES.has(node.type)) {
      issues.push(`${context}: cú pháp ${node.type} không được hỗ trợ`);
      return;
    }
    if (node.type === "link") {
      try {
        assertSafeUrl(node.url, `${context}.link`);
      } catch (error) {
        issues.push(...(error as MarkdownValidationError).issues);
      }
    }
    if (node.type === "image") {
      try {
        assertSafeUrl(node.url, `${context}.image`);
        if (node.url.startsWith("#")) issues.push(`${context}.image: phải là URL http hoặc https`);
      } catch (error) {
        issues.push(...(error as MarkdownValidationError).issues);
      }
    }
  });

  if (issues.length) throw new MarkdownValidationError([...new Set(issues)]);
}

function extractFrontmatter(source: string): { metadata: unknown; body: string } {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new MarkdownValidationError(["frontmatter: file phải bắt đầu bằng ---"]);
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex < 0) throw new MarkdownValidationError(["frontmatter: thiếu dấu --- kết thúc"]);
  return {
    metadata: parseYamlObject(lines.slice(1, closingIndex).join("\n"), "frontmatter"),
    body: lines.slice(closingIndex + 1).join("\n"),
  };
}

function extractDirectives(source: string): Directive[] {
  const lines = source.split("\n");
  const directives: Directive[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const opening = /^:::(section|quiz)\s*$/.exec(lines[index].trim());
    if (!opening) {
      throw new MarkdownValidationError([`dòng ${index + 1}: nội dung phải nằm trong :::section hoặc :::quiz`]);
    }

    const body: string[] = [];
    const startLine = index + 1;
    let fence: "`" | "~" | null = null;
    index += 1;
    for (; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
      if (fenceMatch) {
        const marker = fenceMatch[1][0] as "`" | "~";
        fence = fence === marker ? null : fence ?? marker;
      }
      if (!fence && trimmed === ":::") break;
      body.push(lines[index]);
    }
    if (index >= lines.length) {
      throw new MarkdownValidationError([`dòng ${startLine}: thiếu ::: kết thúc`]);
    }
    directives.push({ kind: opening[1] as Directive["kind"], body: body.join("\n").trim(), line: startLine });
    index += 1;
  }
  return directives;
}

function splitContentBlock(body: string, line: number): { header: unknown; markdown: string } {
  const lines = body.split("\n");
  const divider = lines.findIndex((current) => current.trim() === "");
  if (divider < 0) throw new MarkdownValidationError([`dòng ${line}: section cần một dòng trống sau metadata`]);
  return {
    header: parseYamlObject(lines.slice(0, divider).join("\n"), `section dòng ${line}`),
    markdown: lines.slice(divider + 1).join("\n").trim(),
  };
}

function normalizeQuestion(
  input: z.infer<typeof quizQuestionInputSchema>,
  sectionId: string,
  position: number,
  inheritedOptions?: z.infer<typeof quizOptionInputSchema>[],
): NormalizedQuizQuestion {
  const options = inheritedOptions ?? input.options;
  if (!options) throw new MarkdownValidationError([`quiz ${sectionId}: question phải có options`]);
  const type = input.type === "single" || input.type === "single_choice"
    ? "SINGLE_CHOICE"
    : input.type === "multiple" || input.type === "multiple_choice"
      ? "MULTIPLE_CHOICE"
      : "TRUE_FALSE";
  const normalizedOptions = options.map((option, optionPosition) => ({
    id: normalizeId(option.id ?? `option-${optionPosition + 1}`),
    position: optionPosition,
    content: option.text,
    isCorrect: option.correct,
  }));
  const optionIds = normalizedOptions.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) {
    throw new MarkdownValidationError([`quiz ${sectionId}: option id bị trùng`]);
  }
  const correctCount = normalizedOptions.filter((option) => option.isCorrect).length;
  if (type === "SINGLE_CHOICE" && correctCount !== 1) {
    throw new MarkdownValidationError([`quiz ${sectionId}: single choice phải có đúng một đáp án đúng`]);
  }
  if (type === "MULTIPLE_CHOICE" && correctCount < 1) {
    throw new MarkdownValidationError([`quiz ${sectionId}: multiple choice phải có ít nhất một đáp án đúng`]);
  }
  if (type === "TRUE_FALSE" && (normalizedOptions.length !== 2 || correctCount !== 1)) {
    throw new MarkdownValidationError([`quiz ${sectionId}: true/false phải có hai lựa chọn và đúng một đáp án đúng`]);
  }
  return {
    id: normalizeId(input.id ?? `${sectionId}-question-${position + 1}`),
    position,
    type,
    questionText: input.text,
    options: normalizedOptions,
  };
}

function parseSection(directive: Directive, position: number): NormalizedLessonSection {
  if (directive.kind === "section") {
    const { header, markdown } = splitContentBlock(directive.body, directive.line);
    const result = contentHeaderSchema.safeParse(header);
    if (!result.success) throw formatZodError(`section dòng ${directive.line}`, result.error);
    if (!markdown) throw new MarkdownValidationError([`section ${result.data.id}: nội dung không được để trống`]);
    validateMarkdown(markdown, `section ${result.data.id}`);
    return {
      id: normalizeId(result.data.id),
      position,
      title: result.data.title,
      type: result.data.type === "reflection" ? "REFLECTION" : "CONTENT",
      contentMd: markdown,
    };
  }

  const parsed = quizInputSchema.safeParse(parseYamlObject(directive.body, `quiz dòng ${directive.line}`));
  if (!parsed.success) throw formatZodError(`quiz dòng ${directive.line}`, parsed.error);
  const id = normalizeId(parsed.data.id);
  const questionInputs = parsed.data.questions ?? (parsed.data.question ? [parsed.data.question] : []);
  const questions = questionInputs.map((question, questionPosition) =>
    normalizeQuestion(question, id, questionPosition, questionPosition === 0 ? parsed.data.options : undefined),
  );
  const questionIds = questions.map((question) => question.id);
  if (new Set(questionIds).size !== questionIds.length) {
    throw new MarkdownValidationError([`quiz ${id}: question id bị trùng`]);
  }
  return { id, position, title: parsed.data.title, type: "QUIZ", contentMd: "", quiz: { questions } };
}

export function parseLessonMarkdown(input: string): NormalizedLesson {
  const source = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!source.trim()) throw new MarkdownValidationError(["file Markdown không được để trống"]);
  if (new TextEncoder().encode(source).byteLength > MAX_MARKDOWN_BYTES) {
    throw new MarkdownValidationError(["file Markdown không được vượt quá 1 MB"]);
  }

  const { metadata, body } = extractFrontmatter(source);
  const frontmatter = frontmatterSchema.safeParse(metadata);
  if (!frontmatter.success) throw formatZodError("frontmatter", frontmatter.error);
  const sections = extractDirectives(body).map(parseSection);
  const sectionIds = sections.map((section) => section.id);
  if (new Set(sectionIds).size !== sectionIds.length) {
    throw new MarkdownValidationError(["section id bị trùng"]);
  }
  const lesson = normalizedLessonSchema.safeParse({
    title: frontmatter.data.title,
    description: frontmatter.data.description ?? null,
    sections,
  });
  if (!lesson.success) throw formatZodError("lesson", lesson.error);
  return lesson.data;
}

export { MAX_MARKDOWN_BYTES };
