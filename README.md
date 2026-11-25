# Bé học lớp 1 – game Toán và Tiếng Việt cho Kindle

Game học tập một trang HTML cho bé lớp 1, chạy được trên trình duyệt thử nghiệm của Kindle (màn hình e-ink, đen trắng) và mọi trình duyệt khác. Chạy offline, không cần mạng.

- Bản đồ phiêu lưu 20 chặng, 5 vùng
- Nuôi gà bằng hạt thóc, album nhãn dán
- Trò chơi: chọn đáp án, đúng hay sai, xếp chữ, ô chữ, lật thẻ
- Nhiều người chơi: mỗi bé đăng nhập bằng tên + ngày sinh, tiến trình lưu trên máy chủ (Vercel Blob) nên chơi được ở nhiều máy

## Cấu trúc

- `index.html`: bản hoàn chỉnh (đã nhúng font tiếng Việt), dùng để chép vào Kindle hoặc deploy.
- `src/game.html`: mã nguồn, chưa nhúng font.
- `tools/build.py`: nhúng font DejaVu Sans (rút gọn) vào `src/game.html` để tạo `index.html`.

```
pip install fonttools
python3 tools/build.py index.html
```

## Lưu trên máy chủ (Vercel)

- `api/player.js`: API `POST /api/player` với `action` là `login` hoặc `save`. Mỗi bé là một file JSON riêng trong Vercel Blob (`players/<mã băm tên>.json`). Ngày sinh chỉ lưu dạng mã băm.
- Cần tạo một Blob store **Private** trong Vercel (Storage → Create → Blob) và kết nối với project; Vercel tự thêm biến `BLOB_READ_WRITE_TOKEN`.
- Tuỳ chọn: biến `PIN_SALT` để đổi chuỗi muối khi băm ngày sinh.
- Khi mở `index.html` trực tiếp từ file (không qua web), game chỉ lưu trên máy và có nút "Sao lưu" bằng mã.
