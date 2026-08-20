Trước khi code:

1. Đọc `AGENTS.md`.
2. Inspect code hiện tại, đặc biệt:

   * trang Summary sau buổi học;
   * dữ liệu comment;
   * reaction theo section;
   * các component UI hiện có;
   * cách project đang dùng Supabase;
   * coding convention hiện tại.
3. Không thay đổi architecture hiện tại nếu không thật sự cần.
4. Không tạo thêm file tài liệu, report, plan hoặc abstraction không cần thiết.
5. Nếu cần lập kế hoạch, trình bày ngắn gọn trực tiếp trong chat trước khi code. 

---

# Mục tiêu

Implement feature **Class Voices** cho MINCLASS.

Class Voices là trải nghiệm tổng kết phản hồi của sinh viên sau buổi học, với mục tiêu:

> Biến các comment, câu hỏi và phản hồi của sinh viên thành một trải nghiệm trực quan, tích cực và truyền cảm hứng.

Đây không chỉ là một danh sách comment.

Class Voices phải tạo cảm giác:

> “Đây là tiếng nói thật của cả lớp sau khi cùng nhau trải qua một bài học.”

Tagline sử dụng:

> **Every question moves the class forward.**

---

# Entry Point

Từ trang Summary của Teacher, thêm khu vực:

```text
Class Voices

37 phản hồi từ lớp học hôm nay.

[ Xem tất cả phản hồi ]

[ Trình chiếu Class Voices ✨ ]
```

Không làm thay đổi các thống kê Summary hiện tại.

---

# Dữ liệu

Class Voices chỉ sử dụng dữ liệu hiện có của Session:

* Lesson title.
* Section title.
* Section position.
* Reaction statistics:

  * UNDERSTAND
  * UNSURE
  * QUESTION
* Comments.
* `author_label`.
* `is_anonymous`.
* `created_at`.

Không tạo duplicate table chỉ để phục vụ Class Voices.

Không tạo thêm report data nếu có thể derive trực tiếp từ dữ liệu hiện tại.

---

# MODE 1 — Voice Wall

Teacher bấm:

```text
Xem tất cả phản hồi
```

Hiển thị giao diện dạng Reflection Wall.

## Layout

Group comments theo Section.

Ví dụ:

```text
SECTION 03

TCP Three-Way Handshake

👍 28        🤔 10        ❓ 4


┌─────────────────────────┐
│                         │
│ "Tại sao TCP cần 3 bước │
│ mà không phải 2 bước?"  │
│                         │
│ Anonymous               │
└─────────────────────────┘


┌─────────────────────────┐
│                         │
│ "Em đã hiểu phần SYN-   │
│ ACK rõ hơn rồi."        │
│                         │
│ 23110234                │
└─────────────────────────┘
```

## Yêu cầu

* Comment card sạch, dễ đọc.
* Typography là yếu tố chính.
* Nhiều whitespace.
* Responsive.
* Không render quá nhiều visual gây rối.
* Anonymous comment chỉ hiển thị:

```text
Anonymous
```

Không được lộ MSSV thật.

---

# Filter

Phía trên Wall có filter:

```text
Tất cả
Section 1
Section 2
Section 3
...
```

Teacher có thể xem:

```text
All comments
```

hoặc comment của từng section.

Không cần advanced search trong MVP.

---

# MODE 2 — Presentation Mode

Teacher bấm:

```text
Trình chiếu Class Voices ✨
```

Mở một trải nghiệm fullscreen.

Đây là phần quan trọng nhất của feature.

---

# Presentation Flow

Presentation chạy theo thứ tự Lesson Section.

Ví dụ:

```text
Intro
   ↓
Section 1 Intro
   ↓
Reaction Overview
   ↓
Comment Spotlight
   ↓
Comment Spotlight
   ↓
Section 2 Intro
   ↓
Reaction Overview
   ↓
Comments
   ↓
...
   ↓
Final Message
```

Không tự động chạy quá nhanh.

Teacher phải có thể điều khiển bằng:

```text
Previous
Next
```

và keyboard:

```text
←
→
Escape
```

Có thể thêm:

```text
Play
Pause
```

nếu implementation đơn giản, nhưng không bắt buộc.

---

# INTRO SCREEN

Khi mở Class Voices:

```text
MINCLASS


42 students

31 reflections

8 sections


What did the class think today?
```

Animation:

* fade-in nhẹ;
* number count-up nhẹ nếu implementation gọn;
* không bounce;
* không animation mạnh.

Sau đó Teacher bấm Next.

---

# SECTION INTRO

Ví dụ:

```text
SECTION 03

TCP Three-Way Handshake
```

Sau một transition nhẹ:

```text
👍 28

🤔 10

❓ 4
```

Có thể animate số:

```text
0 → 28
0 → 10
0 → 4
```

Nếu count-up làm code phức tạp thì bỏ và chỉ fade-in.

Không thêm dependency chỉ để làm number animation.

---

# COMMENT SPOTLIGHT

Sau Section Intro, hiển thị từng comment như một "voice".

Ví dụ:

```text
                    “

       Tại sao TCP cần 3 bước
       mà không phải chỉ 2 bước?

                    ”


                 Anonymous
```

Comment phải nằm ở trung tâm visual hierarchy.

Typography lớn.

Background đơn giản.

Animation:

```text
opacity: 0 → 1
translateY: 16px → 0
scale: 0.98 → 1
```

Sau khi chuyển comment:

```text
opacity → 0
```

rồi comment tiếp theo xuất hiện.

Không cần physics.

Không cần 3D.

---

# VOICE STREAM BACKGROUND

Có thể tạo hiệu ứng rất nhẹ:

Một số comment trước đó xuất hiện mờ ở background.

Ví dụ:

```text
   "em chưa hiểu SYN..."

                          "phần này dễ hiểu"

              "SYN-ACK?"

                                  "em hiểu rồi"
```

Rules:

* opacity rất thấp;
* không che comment chính;
* chuyển động cực chậm hoặc static;
* tối đa vài item;
* nếu implementation làm UI phức tạp thì bỏ.

Feature này là optional.

Core vẫn phải hoạt động nếu không có Voice Stream.

---

# REACTION MOMENT

Trước khi hiện comment của một Section, hiển thị reaction overview:

```text
SECTION 04

Congestion Window


👍 18

🤔 17

❓ 7
```

Có thể highlight:

```text
24 phản hồi ở section này
```

Không tự suy luận:

```text
Sinh viên đã hiểu hơn
```

nếu database không có dữ liệu chứng minh điều đó.

---

# INSPIRATIONAL COPY

Có thể xen giữa một số section một câu ngắn.

Ví dụ:

```text
Questions are part of learning.
```

hoặc:

```text
Every question moves the class forward.
```

hoặc tiếng Việt:

```text
Mỗi câu hỏi đều giúp lớp học tiến về phía trước.
```

Không dùng quá nhiều.

Presentation cần giữ cảm giác tinh tế.

---

# FINAL SCREEN

Sau section cuối:

```text
42 students

31 reflections

8 sections

1 shared learning journey
```

Sau đó:

```text
Every question
moves the class forward.
```

Cuối cùng:

```text
MINCLASS
```

Có nút:

```text
[ Xem lại ]

[ Quay về tổng kết ]
```

---

# Visual Direction

Phong cách:

```text
Minimal
Modern
Calm
Warm
Academic
Inspirational
```

Ưu tiên:

* typography;
* spacing;
* subtle gradient;
* soft cards;
* soft shadow;
* smooth fade;
* restrained motion.

Không dùng:

* confetti liên tục;
* neon mạnh;
* flashy gradient;
* 3D;
* WebGL;
* autoplay audio;
* marquee;
* bounce animation;
* hiệu ứng gây mất tập trung.

Mục tiêu:

> Sự truyền cảm hứng đến từ nội dung comment và cách chúng được reveal, không phải từ việc dùng nhiều animation.

---

# Animation Implementation

Ưu tiên sử dụng:

```text
CSS
Tailwind
React state
```

trước.

Chỉ thêm animation library nếu project đã có hoặc nếu implementation bằng CSS trở nên thực sự khó maintain.

Không thêm dependency lớn chỉ cho Class Voices.

---

# Component Structure

Không over-engineer.

Có thể tổ chức tối đa khoảng:

```text
ClassVoices
├── ClassVoicesPage
├── VoiceWall
├── PresentationMode
├── SectionIntro
├── ReactionOverview
├── VoiceSpotlight
└── FinalScreen
```

Nếu có thể giảm số component mà vẫn readable thì hãy giảm.

Không tạo:

```text
ClassVoicesServiceFactory
AnimationManager
VoiceEngine
PresentationControllerFactory
```

hoặc abstraction tương tự.

---

# State Presentation

State tối thiểu có thể gồm:

```text
mode

currentSectionIndex

currentCommentIndex

presentationStep
```

Không cần global state manager.

Không dùng Redux.

---

# Realtime

Class Voices là feature **sau buổi học**.

Không cần realtime subscription.

Load dữ liệu Summary một lần từ database.

---

# Security

Bắt buộc:

1. Chỉ Teacher owner của Room được truy cập Class Voices.
2. Anonymous comment không lộ MSSV.
3. Không query ownership/private author table nếu Teacher không cần.
4. Comment phải render an toàn.
5. Không dùng `dangerouslySetInnerHTML` cho comment.
6. Không expose dữ liệu của Room khác.

---

# Accessibility

Bắt buộc:

* Keyboard navigation.
* Focus visible.
* `Escape` thoát Presentation Mode.
* Buttons có label rõ.
* Contrast đủ.
* Presentation hỗ trợ:

```css
prefers-reduced-motion
```

Nếu user bật reduced motion:

* bỏ slide;
* bỏ scale;
* chỉ dùng instant/fade rất nhẹ.

Animation không được là cách duy nhất để truyền tải thông tin.

---

# Responsive

Voice Wall:

* mobile;
* tablet;
* desktop.

Presentation Mode:

* laptop/projector là ưu tiên;
* vẫn không vỡ trên mobile.

Typography phải responsive.

---

# Empty States

Nếu Session không có comment:

Không hiển thị blank wall.

Hiển thị:

```text
Chưa có comment trong buổi học này.

Các reaction của lớp vẫn được tổng hợp bên dưới.
```

Nếu một Section không có comment:

* vẫn có thể hiển thị reaction overview;
* sau đó chuyển sang Section tiếp theo.

Nếu không có cả reaction và comment:

không cần đưa Section đó vào Presentation Mode nếu không có giá trị hiển thị.

---

# Performance

Không query một lần cho từng Section.

Ưu tiên load data theo Room với số query nhỏ.

Không tạo N+1 query.

Không preload animation asset nặng.

---

# Acceptance Criteria

Feature chỉ hoàn thành khi:

* [ ] Teacher mở Class Voices từ Summary.
* [ ] Voice Wall hoạt động.
* [ ] Comments group theo Section.
* [ ] Filter Section hoạt động.
* [ ] Anonymous không lộ MSSV.
* [ ] Presentation Mode fullscreen hoạt động.
* [ ] Section Intro hoạt động.
* [ ] Reaction Overview hoạt động.
* [ ] Comment Spotlight hoạt động.
* [ ] Previous / Next hoạt động.
* [ ] Keyboard ← → hoạt động.
* [ ] Escape thoát presentation.
* [ ] Final inspirational screen hoạt động.
* [ ] Empty states đầy đủ.
* [ ] Mobile không vỡ.
* [ ] `prefers-reduced-motion` được xử lý.
* [ ] Không thêm dependency không cần thiết.
* [ ] Không tạo architecture phức tạp.
* [ ] Không thay đổi feature khác của MINCLASS.

---

# Test

Thêm relevant tests cho:

1. Teacher owner access.
2. Non-owner access denied.
3. Anonymous comment không render MSSV.
4. Named comment render đúng MSSV.
5. Group comment theo Section.
6. Section filter.
7. Empty comment state.
8. Presentation navigation.
9. Final screen.
10. Reduced-motion behavior nếu có thể test hợp lý.

Manual test với dữ liệu:

```text
Room

Section 1
👍 30
🤔 8
❓ 4
3 comments

Section 2
👍 20
🤔 15
❓ 7
8 comments

Section 3
👍 35
🤔 5
❓ 2
0 comments
```

---

# Quy trình thực hiện

Trước khi sửa code:

1. Inspect code hiện tại.
2. Xác định component/data query có thể reuse.
3. Nêu kế hoạch ngắn trong chat.
4. Nêu các file dự kiến sửa.

Sau đó implement.

Không tạo file plan/report/docs mới.

Sau implementation:

1. chạy lint;
2. chạy typecheck;
3. chạy relevant tests;
4. chạy build;
5. review diff;
6. kiểm tra scope creep;
7. báo ngắn gọn file đã thay đổi và các giới hạn còn lại.

Sau đó dừng.

Không tự chuyển sang feature khác.
