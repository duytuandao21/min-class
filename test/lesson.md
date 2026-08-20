---
title: TCP Three-Way Handshake
description: Bài học ngắn về quy trình thiết lập kết nối TCP.
---

:::section
id: tcp-overview
title: TCP là gì?
type: content

## Tổng quan

TCP là giao thức **tin cậy** và *hướng kết nối*.

Các bước chính:

- SYN
- SYN-ACK
- ACK

Xem thêm tại [MDN](https://developer.mozilla.org).

Dùng cờ `SYN` để bắt đầu:

```text
Client -> SYN -> Server
```
:::

:::section
id: handshake-flow
title: Quy trình Handshake
type: content

1. Client gửi SYN.
2. Server trả về SYN-ACK.
3. Client gửi ACK.
:::

:::quiz
id: handshake-check
title: Quick Check
question:
  type: single
  text: Gói tin nào hoàn tất TCP handshake?
options:
  - text: SYN
    correct: false
  - text: ACK
    correct: true
:::