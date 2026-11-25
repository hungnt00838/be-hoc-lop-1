// API lưu tiến trình người chơi trên Vercel Blob.
// POST /api/player  { action: "login" | "save", name, pin, data? }
const { normName, validDob, pathFor, pinHash, cleanData, readRecord, writeRecord, send, readBody, errOut } = require("./_store");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Chỉ nhận POST" });
  const body = await readBody(req);
  if (!body) return send(res, 400, { ok: false, error: "Dữ liệu không hợp lệ" });

  const name = String(body.name || "").normalize("NFC").trim().replace(/\s+/g, " ");
  const pin = String(body.pin || "");
  if (!name || name.length > 30) return send(res, 400, { ok: false, error: "Tên không hợp lệ" });
  if (!validDob(pin)) return send(res, 400, { ok: false, error: "Ngày sinh không hợp lệ" });

  const path = pathFor(name);
  try {
    const rec = await readRecord(path);
    if (rec && rec.pin !== pinHash(name, pin)) return send(res, 403, { ok: false, error: "Tên hoặc ngày sinh chưa đúng" });

    if (body.action === "login") {
      if (!rec) {
        const fresh = { name, pin: pinHash(name, pin), data: cleanData(body.data), created: Date.now(), updated: Date.now() };
        await writeRecord(path, fresh);
        return send(res, 200, { ok: true, created: true, name, data: fresh.data });
      }
      return send(res, 200, { ok: true, created: false, name: rec.name, data: rec.data || null });
    }
    if (body.action === "save") {
      const data = cleanData(body.data);
      if (!data) return send(res, 400, { ok: false, error: "Thiếu dữ liệu" });
      const next = Object.assign({}, rec || {}, { name: rec ? rec.name : name, pin: pinHash(name, pin), data, created: rec ? rec.created : Date.now(), updated: Date.now() });
      await writeRecord(path, next);
      return send(res, 200, { ok: true, updated: next.updated });
    }
    // ----- Ghi chú của bé -----
    if (body.action === "notes" || body.action === "addNote" || body.action === "delNote") {
      if (!rec) return send(res, 404, { ok: false, error: "Chưa có tài khoản" });
      let notes = Array.isArray(rec.notes) ? rec.notes : [];
      if (body.action === "addNote") {
        const text = String(body.text || "").normalize("NFC").replace(/\r/g, "").trim().slice(0, 500);
        if (!text) return send(res, 400, { ok: false, error: "Ghi chú đang trống" });
        if (notes.length >= 300) return send(res, 400, { ok: false, error: "Đã đủ 300 ghi chú, hãy xoá bớt" });
        notes = [{ ts: Date.now(), text }].concat(notes);
      } else if (body.action === "delNote") {
        const ts = Number(body.ts) || 0;
        notes = notes.filter(n => n.ts !== ts);
      }
      if (body.action !== "notes") { rec.notes = notes; rec.updated = Date.now(); await writeRecord(path, rec); }
      return send(res, 200, { ok: true, notes });
    }
    return send(res, 400, { ok: false, error: "Hành động không hợp lệ" });
  } catch (e) {
    return errOut(res, e);
  }
};
module.exports._test = { pathFor, pinHash, cleanData, normName, validDob };
