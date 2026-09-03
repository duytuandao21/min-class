# MINCLASS MARKDOWN

## Cách viết file Lesson

File `.md`, tối đa 1 MB. Nội dung phải nằm trong section hoặc quiz.

### 1. Frontmatter bắt buộc

File phải bắt đầu bằng `---`. **title** là bắt buộc; **description** có thể bỏ qua.

```yaml
---
title: Tên bài học
description: Mô tả ngắn về bài học.
---
```

### 2. Quy tắc ID

- Dài từ 1–64 ký tự; nên dùng chữ thường, số, dấu `-` hoặc `_`.
- ID Section không được trùng trong toàn Lesson.
- ID câu hỏi không được trùng trong cùng Quiz.
- ID đáp án không được trùng trong cùng câu hỏi.
- ID câu hỏi và đáp án có thể bỏ qua để MINCLASS tự tạo, nhưng nên khai báo rõ.

### 3. Section nội dung và Markdown được hỗ trợ

Dùng `:::section` và kết thúc bằng `:::`. Sau metadata phải có một dòng trống trước nội dung.

Hỗ trợ paragraph, heading, **bold**, *italic*, danh sách có/không thứ tự, link, ảnh URL, inline code, xuống dòng và fenced code block.

````markdown
:::section
id: tcp-overview
title: Tổng quan về TCP
type: content

## Tiêu đề nội dung

Đoạn văn có **chữ đậm**, *chữ nghiêng* và `inline code`.

- Danh sách không thứ tự
- Mục thứ hai

1. Danh sách có thứ tự
2. Bước tiếp theo

[Đọc thêm](https://example.com)

![Mô tả ảnh](https://example.com/image.png)

```text
SYN -> SYN-ACK -> ACK
```
:::
````

### 4. Reflection Section

Reflection dùng cùng cú pháp Section nhưng đặt `type: reflection`. Nội dung không được để trống.

```markdown
:::section
id: pause-and-reflect
title: Dừng lại và suy ngẫm
type: reflection

Hãy giải thích lại ý chính bằng một câu.
:::
```

### 5. URL và nội dung an toàn

- Link chỉ nhận `http`, `https` hoặc anchor dạng `#muc`.
- Ảnh phải là URL `http` hoặc `https`.
- Không hỗ trợ HTML tùy ý, iframe, video, slide hoặc assignment.
- Không đặt văn bản bên ngoài `:::section` hay `:::quiz`.

### 6. Quiz: Single Choice, Multiple Choice và True/False

- `single_choice` hoặc `single`: đúng một đáp án có `correct: true`.
- `multiple_choice` hoặc `multiple`: ít nhất một đáp án đúng.
- `true_false`: đúng hai lựa chọn và đúng một đáp án đúng.
- Mỗi câu hỏi phải có ít nhất hai lựa chọn; nội dung đáp án không được để trống.
- Dùng `questions` cho nhiều câu. Quiz một câu cũng có thể dùng `question` kèm `options`.

```yaml
:::quiz
id: knowledge-check
title: Kiểm tra kiến thức
questions:
  - id: single-question
    type: single_choice
    text: Đâu là đáp án đúng?
    options:
      - id: option-a
        text: Đáp án A
        correct: true
      - id: option-b
        text: Đáp án B
        correct: false

  - id: multiple-question
    type: multiple_choice
    text: Chọn tất cả đáp án đúng.
    options:
      - id: choice-a
        text: Lựa chọn A
        correct: true
      - id: choice-b
        text: Lựa chọn B
        correct: true
      - id: choice-c
        text: Lựa chọn C
        correct: false

  - id: true-false-question
    type: true_false
    text: TCP là giao thức hướng kết nối.
    options:
      - id: answer-true
        text: Đúng
        correct: true
      - id: answer-false
        text: Sai
        correct: false
:::
```

**Lưu ý:** Mỗi Lesson cần ít nhất một Section. Hãy dùng nút **Parse & Preview** để kiểm tra toàn bộ ID, YAML, Markdown và Quiz trước khi lưu.
