// Vercel Cron gọi mỗi ngày (xem vercel.json) để xoá ảnh cũ hơn số ngày đã đặt.
const S = require("./_store");
module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== "Bearer " + secret) return S.send(res, 401, { ok: false });
  try {
    const st = await S.getSettings();
    const removed = await S.cleanupPhotos("photos/", st.photoDays);
    return S.send(res, 200, { ok: true, photoDays: st.photoDays, removed });
  } catch (e) { return S.errOut(res, e); }
};
