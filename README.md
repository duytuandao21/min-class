# MINCLASS

MINCLASS là ứng dụng hỗ trợ lớp học trực tiếp, giúp giảng viên trình bày bài học theo từng section và nhận phản hồi gần realtime từ sinh viên. Sinh viên theo dõi nội dung, gửi reaction hoặc comment và làm quiz ngay trong buổi học mà không cần đăng ký tài khoản.

## Chạy project

Cài dependencies:

```bash
pnpm install
```

Tạo file `.env.local` từ `.env.example` và điền thông tin Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Chạy môi trường development:

```bash
pnpm dev
```

Sau đó truy cập [http://localhost:3000](http://localhost:3000).

Build và chạy production:

```bash
pnpm build
pnpm start
```

## Dành cho giảng viên

1. Chọn **Tạo Room**, nhập tên buổi học và upload file Markdown.
2. Kiểm tra nội dung trong phần preview rồi lưu Room.
3. Chọn **Start Room** và chia sẻ Room Code cho sinh viên.
4. Trình bày section hiện tại, theo dõi reaction, comment và tiến độ quiz.
5. Chọn **Done Section** để chuyển lớp sang section tiếp theo.
6. Khi hoàn tất, chọn **Kết thúc buổi học** để xem Summary và Class Voices.

## Dành cho sinh viên

1. Chọn **Tham gia Room**.
2. Nhập Room Code và MSSV, sau đó chọn **Tham gia**.
3. Theo dõi section đang được giảng viên trình bày.
4. Gửi reaction hoặc comment cho từng section; comment có thể hiển thị MSSV hoặc để ẩn danh.
5. Làm và gửi quiz khi section quiz được mở.
6. Sau khi buổi học kết thúc, bạn vẫn có thể xem lại các section đã được công bố.

## Hướng dẫn viết file bài học Markdown

File phải bắt đầu bằng frontmatter chứa `title` và có thể thêm `description`:

```markdown
---
title: Tên bài học
description: Mô tả ngắn về bài học.
---
```

### Section nội dung

Mỗi section dùng cặp `:::section` và `:::`. `id` phải duy nhất trong toàn bài; sau phần metadata phải có một dòng trống trước nội dung Markdown.

````markdown
:::section
id: section-overview
title: Tổng quan
type: content

## Tiêu đề nội dung

Đây là một đoạn văn có **chữ đậm**, *chữ nghiêng* và `inline code`.

- Mục thứ nhất
- Mục thứ hai

1. Bước một
2. Bước hai

Đọc thêm tại [MDN](https://developer.mozilla.org).

![Mô tả ảnh](https://example.com/image.png)

```text
Ví dụ code block
```
:::
````

Có thể dùng `type: reflection` cho một section suy ngẫm:

```markdown
:::section
id: reflection-check
title: Dừng lại và suy ngẫm
type: reflection

Bạn hãy giải thích lại ý chính của phần vừa học.
:::
```

### Section quiz

Quiz dùng `:::quiz`. MINCLASS hỗ trợ `single_choice`, `multiple_choice` và `true_false`.

```markdown
:::quiz
id: knowledge-check
title: Kiểm tra kiến thức
questions:
  - id: single-question
    type: single_choice
    text: "Đâu là đáp án đúng?"
    options:
      - id: option-a
        text: Đáp án A
        correct: true
      - id: option-b
        text: Đáp án B
        correct: false

  - id: multiple-question
    type: multiple_choice
    text: "Chọn tất cả đáp án đúng."
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
    text: "Nội dung của nhận định này là đúng."
    options:
      - id: answer-true
        text: Đúng
        correct: true
      - id: answer-false
        text: Sai
        correct: false
:::
```

Quy tắc quiz:

- Mỗi câu phải có ít nhất hai lựa chọn.
- `single_choice` phải có đúng một đáp án `correct: true`.
- `multiple_choice` phải có ít nhất một đáp án `correct: true`.
- `true_false` phải có đúng hai lựa chọn và đúng một đáp án đúng.
- `id` của section không được trùng; `id` câu hỏi và lựa chọn cũng phải duy nhất trong phạm vi tương ứng.

Markdown hỗ trợ paragraph, heading, chữ đậm, chữ nghiêng, danh sách, link, ảnh, inline code và fenced code block. Link và ảnh phải dùng URL `http` hoặc `https`. Không dùng HTML tùy ý, iframe, video, slide, assignment hoặc nội dung nằm ngoài `:::section`/`:::quiz`.
