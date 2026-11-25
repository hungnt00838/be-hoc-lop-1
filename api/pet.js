// Thú nuôi cho game. GET /api/pet?img=<id> trả ảnh; POST /api/pet { action: "config" } trả cấu hình.
const S = require("./_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const id = String((req.query && req.query.img) || new URL(req.url, "http://x").searchParams.get("img") || "");
      const img = await S.petImgGet(id);
      if (!img) { res.statusCode = 404; return res.end("Không có ảnh"); }
      res.statusCode = 200;
      res.setHeader("Content-Type", img.type);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.end(img.buf);
    }
    if (req.method !== "POST") return S.send(res, 405, { ok: false, error: "Chỉ nhận GET/POST" });
    return S.send(res, 200, { ok: true, pet: await S.getPet() });
  } catch (e) {
    return S.errOut(res, e);
  }
};
