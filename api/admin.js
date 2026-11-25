// API trang quản trị. Cần biến môi trường ADMIN_PASSWORD trên Vercel.
// POST /api/admin { password, action: "list" | "save" | "delete", ... }
const crypto = require("crypto");
const S = require("./_store");

function okPassword(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  if (!want) return null;
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
function summary(path, rec) {
  const d = rec.data || { st: [], seeds: 0, fed: 0, stk: {} };
  let stars = 0; for (const v of d.st || []) stars += v || 0;
  return { path, name: rec.name, created: rec.created || 0, updated: rec.updated || 0, stars, seeds: d.seeds || 0, fed: d.fed || 0,
    stickers: Object.keys(d.stk || {}).length, mons: (d.mon || []).filter(Boolean).length, data: S.cleanData(d) || S.cleanData({ st: [] }) };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return S.send(res, 405, { ok: false, error: "Chỉ nhận POST" });
  const body = await S.readBody(req);
  if (!body) return S.send(res, 400, { ok: false, error: "Dữ liệu không hợp lệ" });
  const pw = okPassword(body.password);
  if (pw === null) return S.send(res, 503, { ok: false, error: "Chưa đặt ADMIN_PASSWORD trên Vercel" });
  if (!pw) { await new Promise(r => setTimeout(r, 800)); return S.send(res, 401, { ok: false, error: "Sai mật khẩu" }); }

  try {
    if (body.action === "list") {
      const paths = await S.listPaths();
      const players = [];
      for (const p of paths) {
        const rec = await S.readRecord(p);
        if (rec) players.push(summary(p, rec));
      }
      players.sort((a, b) => b.updated - a.updated);
      return S.send(res, 200, { ok: true, players });
    }

    const path = String(body.path || "");
    if (!/^players\/[0-9a-f]{32}\.json$/.test(path)) return S.send(res, 400, { ok: false, error: "Đường dẫn không hợp lệ" });
    const rec = await S.readRecord(path);
    if (!rec) return S.send(res, 404, { ok: false, error: "Không tìm thấy bé này" });

    if (body.action === "delete") {
      await S.deleteRecord(path);
      return S.send(res, 200, { ok: true });
    }

    if (body.action === "save") {
      const data = S.cleanData(body.data);
      if (!data) return S.send(res, 400, { ok: false, error: "Thiếu dữ liệu" });
      const newName = String(body.name || rec.name).normalize("NFC").trim().replace(/\s+/g, " ");
      if (!newName || newName.length > 30) return S.send(res, 400, { ok: false, error: "Tên không hợp lệ" });
      const dob = String(body.dob || "");
      if (dob && !S.validDob(dob)) return S.send(res, 400, { ok: false, error: "Ngày sinh không hợp lệ" });
      const renamed = S.normName(newName) !== S.normName(rec.name);
      if (renamed && !dob) return S.send(res, 400, { ok: false, error: "Đổi tên thì cần nhập lại ngày sinh" });
      const newPath = renamed ? S.pathFor(newName) : path;
      if (renamed && await S.readRecord(newPath)) return S.send(res, 409, { ok: false, error: "Đã có bé khác tên này" });
      const next = { name: newName, pin: dob ? S.pinHash(newName, dob) : rec.pin, data, created: rec.created || Date.now(), updated: Date.now() };
      await S.writeRecord(newPath, next);
      if (renamed) await S.deleteRecord(path);
      return S.send(res, 200, { ok: true, player: summary(newPath, next) });
    }
    return S.send(res, 400, { ok: false, error: "Hành động không hợp lệ" });
  } catch (e) {
    return S.errOut(res, e);
  }
};
