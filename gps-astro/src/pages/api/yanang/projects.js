import { supabase } from "../../../lib/supabase.js";
import { authorizeYanang, isValidCoordinate, json } from "../../../lib/yanang-integration.js";

export const prerender = false;

const VALID_STATUSES = new Set(["in-progress", "delayed", "planned", "completed"]);
const VALID_VERDICTS = new Set(["pass", "fail", "pending"]);
const MAX_U32 = 4_294_967_295;

function projectToContract(row) {
  const id = Number(row.legacy_id);
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const status = String(row.status || "");
  const verdictCandidate = String(row.compliance_verdict || "pending");
  const complianceVerdict = VALID_VERDICTS.has(verdictCandidate) ? verdictCandidate : "pending";
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_U32
    || !isValidCoordinate(lat, lng) || !VALID_STATUSES.has(status)) return null;

  const radiusCandidate = Number(row.radius_km);
  const speedCandidate = Number(row.extra?.speedLimit ?? row.extra?.speed_limit);
  const speedLimit = Number.isInteger(speedCandidate) && speedCandidate > 0 && speedCandidate <= 200
    ? speedCandidate : 60;
  const closedCandidate = row.extra?.closedLanes ?? row.extra?.closed_lanes;
  const closedLanes = typeof closedCandidate === "string" && closedCandidate.trim()
    ? closedCandidate.trim()
    : status === "planned" ? "ยังไม่เริ่มปิดช่องจราจร" : "บางช่องจราจร";

  return {
    id,
    name: String(row.name || ""),
    province: String(row.province || ""),
    contractor: String(row.contractor || ""),
    status,
    start: row.start_date ? String(row.start_date) : "",
    end: row.end_date ? String(row.end_date) : "",
    lat,
    lng,
    roadName: row.road_name ? String(row.road_name) : "",
    radiusKm: Number.isFinite(radiusCandidate) && radiusCandidate > 0 ? radiusCandidate : 0.3,
    complianceVerdict,
    closedLanes,
    speedLimit,
  };
}

export async function GET({ request }) {
  const unauthorized = authorizeYanang(request);
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("projects")
    .select("legacy_id,name,province,contractor,status,start_date,end_date,lat,lng,road_name,radius_km,compliance_verdict,extra")
    .order("legacy_id", { ascending: true });

  if (error) return json({ error: "ไม่สามารถโหลดข้อมูลโครงการได้" }, 500);
  const projects = (data || []).map(projectToContract).filter(Boolean);
  return json(projects);
}
