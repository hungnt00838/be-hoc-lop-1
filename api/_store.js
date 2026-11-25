// Dùng chung cho api/player.js và api/admin.js (file bắt đầu bằng "_" không thành đường dẫn API).
const crypto = require("crypto");
const { put, get, list, del } = require("@vercel/blob");

const ACCESS = process.env.BLOB_ACCESS === "public" ? "public" : "private";
const SALT = process.env.PIN_SALT || "be-hoc-lop-1";
const STAGES = 20;

function normName(n) {
  return String(n || "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}
// "pin" là ngày sinh dạng YYYY-MM-DD
function validDob(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  return y >= 1990 && y <= new Date().getUTCFullYear() && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}
function sha(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
function pathFor(name) { return "players/" + sha("name:" + normName(name)).slice(0, 32) + ".json"; }
function pinHash(name, pin) { return sha(SALT + ":" + normName(name) + ":" + pin); }

function cleanData(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.st)) return null;
  const num = (v, max) => { v = Math.floor(Number(v) || 0); return v < 0 ? 0 : (v > max ? max : v); };
  const out = { st: [], seeds: num(d.seeds, 1e6), fed: num(d.fed, 1e5), stk: {} };
  for (let i = 0; i < STAGES; i++) out.st.push(num(d.st[i], 3));
  if (d.stk && typeof d.stk === "object") {
    for (let i = 0; i < STAGES; i++) if (d.stk[i]) out.stk[i] = 1;
  }
  out.mon = [];
  for (let i = 0; i < 8; i++) out.mon.push(Array.isArray(d.mon) && d.mon[i] ? 1 : 0);
  return out;
}

async function readRecord(path) {
  const r = await get(path, { access: ACCESS, useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const text = await new Response(r.stream).text();
  return JSON.parse(text);
}
async function writeRecord(path, rec) {
  await put(path, JSON.stringify(rec), {
    access: ACCESS, addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60
  });
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

async function deleteRecord(path) { await del(path); }
async function listPaths() {
  const out = []; let cursor;
  do {
    const r = await list({ prefix: "players/", limit: 1000, cursor });
    for (const b of r.blobs) out.push(b.pathname);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}
async function readBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  return body && typeof body === "object" ? body : null;
}
function errOut(res, e) {
  console.error(e);
  return send(res, 500, {
    ok: false, error: "Máy chủ lỗi, thử lại sau",
    detail: String((e && e.message) || e).slice(0, 200),
    hasToken: !!process.env.BLOB_READ_WRITE_TOKEN, access: ACCESS
  });
}
// ----- Ảnh của bé: photos/<id bé>/<thời điểm>.jpg và <thời điểm>_t.jpg (ảnh nhỏ) -----
function newId() { return crypto.randomBytes(12).toString("hex"); }
async function ensureId(path, rec) {
  if (rec.id) return rec.id;
  rec.id = newId(); await writeRecord(path, rec); return rec.id;
}
async function readB64(p) {
  const r = await get(p, { access: ACCESS, useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer()).toString("base64");
}
async function photoList(id, withThumbs) {
  const out = []; let cursor;
  do {
    const r = await list({ prefix: "photos/" + id + "/", limit: 1000, cursor });
    for (const b of r.blobs) { const m = /\/(\d+)_t\.jpg$/.exec(b.pathname); if (m) out.push({ ts: +m[1] }); }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  out.sort((a, b) => b.ts - a.ts);
  if (withThumbs) {
    const top = out.slice(0, 60);
    await Promise.all(top.map(async o => { const b = await readB64("photos/" + id + "/" + o.ts + "_t.jpg"); o.thumb = b ? "data:image/jpeg;base64," + b : null; }));
    return top;
  }
  return out;
}
async function photoGet(id, ts) { const b = await readB64("photos/" + id + "/" + Math.floor(ts) + ".jpg"); return b ? "data:image/jpeg;base64," + b : null; }
function jpegBuf(dataUrl, maxBytes) {
  const pre = "data:image/jpeg;base64,";
  if (typeof dataUrl !== "string" || dataUrl.indexOf(pre) !== 0) return null;
  const buf = Buffer.from(dataUrl.slice(pre.length), "base64");
  if (!buf.length || buf.length > maxBytes || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  return buf;
}
async function photoPut(id, ts, full, thumb) {
  const o = { access: ACCESS, addRandomSuffix: false, allowOverwrite: true, contentType: "image/jpeg" };
  await put("photos/" + id + "/" + ts + ".jpg", full, o);
  await put("photos/" + id + "/" + ts + "_t.jpg", thumb, o);
}
async function photoDel(id, ts) { ts = Math.floor(ts); await del(["photos/" + id + "/" + ts + ".jpg", "photos/" + id + "/" + ts + "_t.jpg"]); }
// ----- Cài đặt chung + tự xoá ảnh cũ -----
const SETTINGS = "settings/config.json";
const DEFAULT_SETTINGS = { photoDays: 30 };
async function getSettings() {
  try { const r = await readRecord(SETTINGS); return Object.assign({}, DEFAULT_SETTINGS, r || {}); } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}
async function setSettings(s) {
  const days = Math.max(0, Math.min(3650, Math.floor(Number(s.photoDays) || 0)));
  const next = Object.assign({}, await getSettings(), { photoDays: days });
  await writeRecord(SETTINGS, next); return next;
}
// Xoá ảnh cũ hơn photoDays ngày. prefix: "photos/" (tất cả) hoặc "photos/<id>/" (một bé)
async function cleanupPhotos(prefix, days) {
  if (days === undefined) days = (await getSettings()).photoDays;
  if (!days) return 0;
  const cutoff = Date.now() - days * 86400000, old = []; let cursor;
  do {
    const r = await list({ prefix: prefix || "photos/", limit: 1000, cursor });
    for (const b of r.blobs) { const m = /\/(\d+)(_t)?\.jpg$/.exec(b.pathname); if (m && +m[1] < cutoff) old.push(b.pathname); }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  for (let i = 0; i < old.length; i += 100) await del(old.slice(i, i + 100));
  return old.length;
}
module.exports = { getSettings, setSettings, cleanupPhotos, newId, ensureId, photoList, photoGet, photoPut, photoDel, jpegBuf, STAGES, normName, validDob, sha, pathFor, pinHash, cleanData, readRecord, writeRecord, deleteRecord, listPaths, send, readBody, errOut };
