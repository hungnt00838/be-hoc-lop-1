# Bé học lớp 1 – game Toán và Tiếng Việt cho Kindle

Game học tập một trang HTML cho bé lớp 1, chạy được trên trình duyệt thử nghiệm của Kindle (màn hình e-ink, đen trắng) và mọi trình duyệt khác. Chạy offline, không cần mạng.

- Bản đồ phiêu lưu 20 chặng, 5 vùng
- Nuôi gà bằng hạt thóc, album nhãn dán
- Trò chơi: chọn đáp án, đúng hay sai, xếp chữ, ô chữ, lật thẻ
- Nhiều người chơi, mỗi bé có tiến trình riêng

## Cấu trúc

- `index.html`: bản hoàn chỉnh (đã nhúng font tiếng Việt), dùng để chép vào Kindle hoặc deploy.
- `src/game.html`: mã nguồn, chưa nhúng font.
- `tools/build.py`: nhúng font DejaVu Sans (rút gọn) vào `src/game.html` để tạo `index.html`.

```
pip install fonttools
python3 tools/build.py index.html
```
