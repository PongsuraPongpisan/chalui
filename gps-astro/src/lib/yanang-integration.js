import crypto from "node:crypto";

export const YANANG_PROBLEM_META = Object.freeze({
  no_cones: { title: "ไม่มีกรวยยาง", type: "Construction" },
  no_sign: { title: "ไม่มีป้ายเตือน", type: "Construction" },
  data_mismatch: { title: "ข้อมูลโครงการไม่ตรงกับหน้างาน", type: "Construction" },
  heavy_traffic: { title: "การจราจรติดขัดหนัก", type: "Traffic" },
  other: { title: "ปัญหาอื่น ๆ", type: "Other" },
});

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  });
}

function getEnv(key) {
  return (import.meta.env && import.meta.env[key])
    || (typeof process !== "undefined" && process.env && process.env[key])
    || "";
}

export function authorizeYanang(request) {
  const expected = String(getEnv("YANANG_ADMIN_API_KEY")).trim();
  if (!expected) return null;
  const actual = request.headers.get("X-Yanang-Key") || "";
  if (!actual) return json({ error: "Missing X-Yanang-Key" }, 401);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  const matches = expectedBuffer.length === actualBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  return matches ? null : json({ error: "Invalid X-Yanang-Key" }, 403);
}

export function isValidCoordinate(lat, lng) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
