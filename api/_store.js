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
module.exports = { STAGES, normName, validDob, sha, pathFor, pinHash, cleanData, readRecord, writeRecord, deleteRecord, listPaths, send, readBody, errOut };
