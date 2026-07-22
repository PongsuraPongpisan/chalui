import { supabase } from "../../../lib/supabase.js";
import { authorizeYanang, isValidCoordinate, json, YANANG_PROBLEM_META } from "../../../lib/yanang-integration.js";

export const prerender = false;

const MAX_U32 = 4_294_967_295;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function validateReport(input) {
  const id = input?.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    return { error: "รหัสรายงานไม่ถูกต้อง" };
  }

  const zoneId = input.zone_id;
  if (zoneId !== null && (typeof zoneId !== "number"
    || !Number.isSafeInteger(zoneId) || zoneId < 1 || zoneId > MAX_U32)) {
    return { error: "รหัสโครงการไม่ถูกต้อง" };
  }
  if (!Object.hasOwn(YANANG_PROBLEM_META, input.problem_type)) {
    return { error: "ประเภทปัญหาไม่ถูกต้อง" };
  }
  if (typeof input.description !== "string" || [...input.description].length > 500) {
    return { error: "รายละเอียดต้องมีความยาวไม่เกิน 500 ตัวอักษร" };
  }

  const { lat, lng } = input;
  if (typeof lat !== "number" || typeof lng !== "number" || !isValidCoordinate(lat, lng)) {
    return { error: "พิกัดตำแหน่งไม่ถูกต้อง" };
  }
  if (input.status !== "pending") return { error: "สถานะเริ่มต้นต้องเป็น pending" };
  if (typeof input.created_at !== "string" || !input.created_at.endsWith("Z")) {
    return { error: "created_at ต้องเป็นเวลา ISO 8601 UTC" };
  }
  const createdDate = new Date(input.created_at);
  if (Number.isNaN(createdDate.getTime())) return { error: "created_at ไม่ถูกต้อง" };

  return {
    report: {
      id,
      zone_id: zoneId,
      problem_type: input.problem_type,
      description: input.description,
      lat,
      lng,
      status: "pending",
      created_at: createdDate.toISOString(),
    },
  };
}

function sameReport(existing, incoming) {
  return existing.id === incoming.id
    && (existing.zone_id === null ? null : Number(existing.zone_id)) === incoming.zone_id
    && existing.problem_type === incoming.problem_type
    && existing.description === incoming.description
    && Number(existing.lat) === incoming.lat
    && Number(existing.lng) === incoming.lng
    && new Date(existing.created_at).toISOString() === incoming.created_at;
}

export async function POST({ request }) {
  const unauthorized = authorizeYanang(request);
  if (unauthorized) return unauthorized;

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "JSON request body ไม่ถูกต้อง" }, 400);
  }
  const validation = validateReport(input);
  if (validation.error) return json({ error: validation.error }, 422);
  const report = validation.report;

  const { error } = await supabase.from("yanang_reports").insert(report);
  if (!error) return json({ reportId: report.id, status: "submitted" }, 201);
  if (error.code !== "23505") return json({ error: "ไม่สามารถบันทึกรายงานได้" }, 500);

  const { data: existing, error: readError } = await supabase
    .from("yanang_reports")
    .select("id,zone_id,problem_type,description,lat,lng,status,created_at")
    .eq("id", report.id)
    .maybeSingle();
  if (readError || !existing) return json({ error: "ไม่สามารถตรวจสอบรายงานเดิมได้" }, 500);
  if (!sameReport(existing, report)) {
    return json({ error: "รหัสรายงานนี้ถูกใช้กับข้อมูลอื่นแล้ว" }, 409);
  }
  return json({ reportId: report.id, status: "submitted" }, 200);
}
