import { supabase } from "../../lib/supabase.js";

export const prerender = false;

// Client shape: { id, type, title, description, image, images[], lat, lng,
// timestamp, reporter }. image remains the first album image for old clients.
const MAX_REPORT_IMAGES = 6;
const MAX_REPORT_IMAGE_PAYLOAD = 5_500_000;

function normalizeReportImages(images, legacyImage) {
  let candidates = Array.isArray(images) ? images : [];
  if (!candidates.length && typeof legacyImage === "string" && legacyImage) {
    try {
      const parsed = JSON.parse(legacyImage);
      candidates = Array.isArray(parsed) ? parsed : [legacyImage];
    } catch {
      candidates = [legacyImage];
    }
  }
  return candidates
    .filter((value) => typeof value === "string" && value.trim())
    .slice(0, MAX_REPORT_IMAGES);
}

function rowToClient(row) {
  const images = normalizeReportImages([], row.image_url);
  return {
    id: row.legacy_id,
    type: row.type,
    title: row.title,
    description: row.description,
    image: images[0] || null,
    images,
    lat: row.lat,
    lng: row.lng,
    timestamp: row.created_at,
    reporter: row.reporter_name,
    status: row.status,
    projectId: row.project_id,
  };
}

export async function GET() {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data.map(rowToClient)), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }) {
  try {
    const report = await request.json();
    const title = typeof report.title === "string" ? report.title.trim() : "";
    const lat = Number(report.lat);
    const lng = Number(report.lng);
    const images = normalizeReportImages(report.images, report.image);
    const imagePayloadSize = images.reduce((total, image) => total + image.length, 0);

    if (!title) {
      return new Response(JSON.stringify({ error: "กรุณาระบุหัวข้อรายงาน" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return new Response(JSON.stringify({ error: "พิกัด GPS ไม่ถูกต้อง" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (imagePayloadSize > MAX_REPORT_IMAGE_PAYLOAD) {
      return new Response(JSON.stringify({ error: "รูปภาพรวมมีขนาดใหญ่เกิน 5.5 MB" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }

    const row = {
      legacy_id: report.id,
      type: report.type || "Other",
      title,
      description: report.description || null,
      image_url: images.length > 1 ? JSON.stringify(images) : (images[0] || null),
      lat,
      lng,
      reporter_name: report.reporter || "ประชาชน",
    };
    if (report.timestamp) {
      row.created_at = new Date(report.timestamp).toISOString();
    }

    const { data, error } = await supabase
      .from("reports")
      .insert(row)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, report: rowToClient(data) }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
