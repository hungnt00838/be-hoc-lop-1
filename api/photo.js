// Ảnh của từng bé. POST /api/photo { action: "upload" | "list" | "get" | "delete", name, pin, ... }
const S = require("./_store");
const MAX_PHOTOS = 300;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return S.send(res, 405, { ok: false, error: "Chỉ nhận POST" });
  const body = await S.readBody(req);
  if (!body) return S.send(res, 400, { ok: false, error: "Dữ liệu không hợp lệ" });
  const name = String(body.name || "").normalize("NFC").trim().replace(/\s+/g, " ");
  const pin = String(body.pin || "");
  if (!name || !S.validDob(pin)) return S.send(res, 400, { ok: false, error: "Cần đăng nhập" });
  try {
    const path = S.pathFor(name);
    const rec = await S.readRecord(path);
    if (!rec) return S.send(res, 404, { ok: false, error: "Chưa có tài khoản, hãy vào game trước" });
    if (rec.pin !== S.pinHash(name, pin)) return S.send(res, 403, { ok: false, error: "Tên hoặc ngày sinh chưa đúng" });
    const id = await S.ensureId(path, rec);

    if (body.action === "list") return S.send(res, 200, { ok: true, photos: await S.photoList(id, true) });
    if (body.action === "get") {
      const img = await S.photoGet(id, Number(body.ts) || 0);
      return img ? S.send(res, 200, { ok: true, image: img }) : S.send(res, 404, { ok: false, error: "Không tìm thấy ảnh" });
    }
    if (body.action === "delete") { await S.photoDel(id, Number(body.ts) || 0); return S.send(res, 200, { ok: true }); }
    if (body.action === "upload") {
      const full = S.jpegBuf(body.image, 1500000), thumb = S.jpegBuf(body.thumb, 120000);
      if (!full || !thumb) return S.send(res, 400, { ok: false, error: "Ảnh không hợp lệ hoặc quá lớn" });
      const count = (await S.photoList(id, false)).length;
      if (count >= MAX_PHOTOS) return S.send(res, 400, { ok: false, error: "Đã đủ " + MAX_PHOTOS + " ảnh, hãy xoá bớt" });
      const ts = Date.now();
      await S.photoPut(id, ts, full, thumb);
      return S.send(res, 200, { ok: true, ts });
    }
    return S.send(res, 400, { ok: false, error: "Hành động không hợp lệ" });
  } catch (e) {
    return S.errOut(res, e);
  }
};
