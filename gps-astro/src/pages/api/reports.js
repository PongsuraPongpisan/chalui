import { supabase } from "../../lib/supabase.js";

export const prerender = false;

// Client shape (from script.js submitReport): { id, type, title, description,
// image, lat, lng, timestamp, reporter }
function rowToClient(row) {
  return {
    id: row.legacy_id,
    type: row.type,
    title: row.title,
    description: row.description,
    image: row.image_url,
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

    const row = {
      legacy_id: report.id,
      type: report.type || "Other",
      title: report.title,
      description: report.description || null,
      image_url: report.image || null,
      lat: report.lat,
      lng: report.lng,
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
