---
title: TCP — Từ kết nối đến truyền dữ liệu tin cậy
description: Bài học mẫu đầy đủ để kiểm tra upload, preview, release section, reflection và quiz trong MINCLASS.
---

:::section
id: learning-goals
title: Mục tiêu bài học
type: content

## Sau bài học này

Bạn có thể **giải thích vai trò của TCP**, mô tả *three-way handshake* và đọc được một luồng trao đổi gói tin cơ bản.

Các mục tiêu chính:

- Phân biệt TCP với UDP ở mức khái niệm.
- Nhận biết các cờ `SYN`, `ACK` và `FIN`.
- Giải thích vì sao TCP cần số thứ tự và xác nhận.
- Phân tích được quá trình mở và đóng kết nối.
:::

:::section
id: tcp-overview
title: TCP là gì?
type: content

## Giao thức hướng kết nối

TCP là giao thức tầng vận chuyển cung cấp một kênh truyền **tin cậy**, *có thứ tự* và có cơ chế kiểm soát luồng giữa hai ứng dụng.

Một kết nối TCP thường có các đặc điểm:

1. Thiết lập kết nối trước khi gửi dữ liệu.
2. Đánh số thứ tự cho dữ liệu.
3. Xác nhận dữ liệu đã nhận.
4. Gửi lại dữ liệu khi phát hiện mất gói.

Bạn có thể đọc thêm về [TCP trên MDN](https://developer.mozilla.org/en-US/docs/Glossary/TCP).

![Minh họa lớp học MINCLASS](http://203.145.47.240/_next/image?url=http%3A%2F%2F203.145.47.240%2Fapi%2Fmedia%2Ffile%2F9e3a358e7ad273b87bed62b6985148b3d4c8bcf3.png%3F2026-07-18T01%3A40%3A44.461Z&w=3840&q=90)
:::

:::section
id: tcp-header
title: Các cờ TCP quan trọng
type: content

## Cờ điều khiển

Các cờ xuất hiện thường xuyên trong bài học:

- `SYN`: yêu cầu đồng bộ số thứ tự và mở kết nối.
- `ACK`: xác nhận dữ liệu hoặc gói điều khiển đã nhận.
- `FIN`: đề nghị kết thúc kết nối theo cách bình thường.
- `RST`: đóng kết nối ngay khi có lỗi hoặc trạng thái không hợp lệ.

Ví dụ biểu diễn một TCP header tối giản:

```text
Source Port | Destination Port
Sequence Number
Acknowledgment Number
Flags: SYN ACK FIN RST
Window Size | Checksum
```
:::

:::section
id: handshake-flow
title: Quy trình Three-Way Handshake
type: content

## Ba bước thiết lập kết nối

1. Client gửi `SYN` với số thứ tự ban đầu.
2. Server trả về `SYN-ACK` để xác nhận và gửi số thứ tự của server.
3. Client gửi `ACK`; kết nối chuyển sang trạng thái đã thiết lập.

```text
Client                                Server
  | -------- SYN, seq = x ----------> |
  | <--- SYN-ACK, seq = y, ack=x+1 --- |
  | -------- ACK, ack = y+1 ---------> |
  |         Connection ready           |
```

Sau bước cuối, hai phía có thể bắt đầu trao đổi dữ liệu ứng dụng.
:::

:::section
id: reliable-delivery
title: TCP đảm bảo độ tin cậy như thế nào?
type: content

## Sequence và Acknowledgment

TCP dùng `sequence number` để theo dõi vị trí dữ liệu và `acknowledgment number` để báo byte tiếp theo mà bên nhận đang chờ.

Nếu một đoạn dữ liệu chưa được xác nhận trong thời gian phù hợp, bên gửi có thể **truyền lại** đoạn đó. Dữ liệu đến sai thứ tự được sắp xếp trước khi chuyển lên ứng dụng.

## Kiểm soát luồng

Giá trị *receive window* giúp bên nhận thông báo lượng dữ liệu mà mình có thể tiếp tục xử lý. Cơ chế này tránh việc bên gửi truyền nhanh hơn khả năng tiếp nhận.
:::

:::section
id: closing-connection
title: Kết thúc kết nối
type: content

## Đóng kết nối có kiểm soát

Một phía gửi `FIN` khi không còn dữ liệu cần gửi. Phía kia xác nhận bằng `ACK` và có thể tiếp tục gửi phần dữ liệu còn lại trước khi gửi `FIN` của chính mình.

Luồng đơn giản:

```text
FIN -> ACK -> FIN -> ACK
```

Khác với `FIN`, cờ `RST` kết thúc kết nối ngay và thường biểu thị một tình huống bất thường.
:::

:::section
id: pause-and-reflect
title: Dừng lại và tự kiểm tra
type: reflection

## Câu hỏi suy ngẫm

Hãy thử giải thích bằng một câu: **Vì sao chỉ gửi một gói SYN là chưa đủ để hai phía tin rằng kết nối đã sẵn sàng?**

Bạn có thể dùng reaction để báo mức độ hiểu và gửi comment nếu còn điểm chưa chắc chắn.
:::

:::quiz
id: tcp-knowledge-check
title: Kiểm tra kiến thức TCP
questions:
  - id: handshake-final-packet
    type: single_choice
    text: "Gói tin nào hoàn tất TCP three-way handshake?"
    options:
      - id: syn-only
        text: SYN
        correct: false
      - id: syn-ack
        text: SYN-ACK
        correct: false
      - id: final-ack
        text: ACK cuối từ client
        correct: true
      - id: fin-packet
        text: FIN
        correct: false

  - id: reliable-features
    type: multiple_choice
    text: "Những cơ chế nào giúp TCP truyền dữ liệu tin cậy?"
    options:
      - id: sequence-number
        text: Số thứ tự
        correct: true
      - id: acknowledgment
        text: Xác nhận ACK
        correct: true
      - id: retransmission
        text: Truyền lại dữ liệu bị mất
        correct: true
      - id: random-routing
        text: Chọn đường đi ngẫu nhiên
        correct: false

  - id: tcp-connection-oriented
    type: true_false
    text: "TCP là giao thức hướng kết nối."
    options:
      - id: statement-true
        text: Đúng
        correct: true
      - id: statement-false
        text: Sai
        correct: false

  - id: syn-purpose
    type: single
    text: "Mục đích chính của cờ SYN là gì?"
    options:
      - id: open-connection
        text: Khởi tạo kết nối và đồng bộ số thứ tự
        correct: true
      - id: close-connection
        text: Kết thúc kết nối bình thường
        correct: false
      - id: encrypt-data
        text: Mã hóa dữ liệu ứng dụng
        correct: false
      - id: resolve-domain
        text: Phân giải tên miền
        correct: false

  - id: control-flags
    type: multiple
    text: "Chọn các cờ TCP được đề cập trong bài học."
    options:
      - id: syn
        text: SYN
        correct: true
      - id: ack
        text: ACK
        correct: true
      - id: fin
        text: FIN
        correct: true
      - id: rst
        text: RST
        correct: true
      - id: dns
        text: DNS
        correct: false

  - id: receive-window
    type: single_choice
    text: "Receive window chủ yếu hỗ trợ cơ chế nào?"
    options:
      - id: flow-control
        text: Kiểm soát luồng
        correct: true
      - id: name-resolution
        text: Phân giải tên miền
        correct: false
      - id: encryption
        text: Mã hóa đầu cuối
        correct: false
      - id: routing
        text: Định tuyến giữa các mạng
        correct: false

  - id: rst-normal-close
    type: true_false
    text: "RST luôn là cách đóng kết nối bình thường và có kiểm soát."
    options:
      - id: rst-true
        text: Đúng
        correct: false
      - id: rst-false
        text: Sai
        correct: true

  - id: connection-close-order
    type: single_choice
    text: "Chuỗi nào mô tả quá trình đóng kết nối đơn giản trong bài?"
    options:
      - id: syn-synack-ack
        text: SYN → SYN-ACK → ACK
        correct: false
      - id: fin-ack-fin-ack
        text: FIN → ACK → FIN → ACK
        correct: true
      - id: ack-syn-fin
        text: ACK → SYN → FIN
        correct: false
      - id: rst-rst
        text: RST → RST
        correct: false
:::
