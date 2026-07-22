import crypto from "node:crypto";
import { supabase } from "../../lib/supabase.js";

export const prerender = false;

const CITIZEN_COOKIE = "chalui_citizen_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  });
}

function readCitizenId(cookies) {
  const value = cookies.get(CITIZEN_COOKIE)?.value || "";
  return UUID_PATTERN.test(value) ? value : null;
}

function ensureCitizenId(cookies) {
  const existing = readCitizenId(cookies);
  if (existing) return existing;
  const value = crypto.randomUUID();
  cookies.set(CITIZEN_COOKIE, value, {
    httpOnly: true, secure: import.meta.env.PROD, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return value;
}

async function resolveProject(projectId) {
  const legacyId = Number(projectId);
  if (!Number.isSafeInteger(legacyId) || legacyId < 1) return { error: "รหัสโครงการไม่ถูกต้อง", status: 400 };
  const { data, error } = await supabase.from("projects").select("id, legacy_id").eq("legacy_id", legacyId).maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: "ไม่พบโครงการ", status: 404 };
  return { project: data };
}

function serializeReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    author: "ประชาชน",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function reviewPayload(projectUuid, citizenId = null) {
  const { data, error } = await supabase
    .from("project_reviews")
    .select("id, citizen_identifier, rating, comment, created_at, updated_at")
    .eq("project_id", projectUuid)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const reviewCount = rows.length;
  const averageRating = reviewCount
    ? rows.reduce((sum, review) => sum + Number(review.rating), 0) / reviewCount
    : 0;
  const own = citizenId ? rows.find((review) => review.citizen_identifier === citizenId) : null;
  return {
    averageRating: Number(averageRating.toFixed(1)),
    reviewCount,
    reviews: rows.map(serializeReview),
    myReview: own ? serializeReview(own) : null,
  };
}

export async function GET({ url, cookies }) {
  const resolved = await resolveProject(url.searchParams.get("projectId"));
  if (resolved.error) return json({ error: resolved.error }, resolved.status);
  try {
    return json(await reviewPayload(resolved.project.id, readCitizenId(cookies)));
  } catch (error) {
    return json({ error: error.message || "ไม่สามารถโหลดรีวิวได้" }, 500);
  }
}

export async function POST({ request, cookies }) {
  try {
    const body = await request.json();
    const resolved = await resolveProject(body.projectId);
    if (resolved.error) return json({ error: resolved.error }, resolved.status);
    const rating = Number(body.rating);
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ error: "กรุณาเลือกคะแนน 1–5 ดาว" }, 400);
    }
    if (comment.length < 3 || comment.length > 1000) {
      return json({ error: "ความคิดเห็นต้องมีความยาว 3–1,000 ตัวอักษร" }, 400);
    }

    const citizenId = ensureCitizenId(cookies);
    const now = new Date().toISOString();
    const { error } = await supabase.from("project_reviews").upsert({
      project_id: resolved.project.id,
      citizen_identifier: citizenId,
      rating,
      comment,
      updated_at: now,
    }, { onConflict: "project_id,citizen_identifier" });
    if (error) return json({ error: error.message }, 400);
    return json({ success: true, ...(await reviewPayload(resolved.project.id, citizenId)) }, 201);
  } catch (error) {
    return json({ error: error.message || "ส่งรีวิวไม่สำเร็จ" }, 400);
  }
}
