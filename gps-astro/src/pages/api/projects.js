import { supabase } from "../../lib/supabase.js";
import { clientToRow, rowToClient } from "../../lib/project-mapper.js";

export const prerender = false;

export async function GET() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("legacy_id", { ascending: true });

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
    const project = await request.json();
    const row = clientToRow(project);
    row.legacy_id = project.id;

    const { data, error } = await supabase
      .from("projects")
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
      JSON.stringify({ success: true, project: rowToClient(data) }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PUT({ request }) {
  try {
    const project = await request.json();
    if (project.id === undefined) {
      return new Response(JSON.stringify({ error: "Missing project id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Merge extra fields with the existing row's extra instead of overwriting it,
    // so partial updates (e.g. just a compliance verdict) don't wipe other data.
    const { data: existing } = await supabase
      .from("projects")
      .select("extra")
      .eq("legacy_id", project.id)
      .single();

    const row = clientToRow(project);
    if (row.extra && existing?.extra) {
      row.extra = { ...existing.extra, ...row.extra };
    }

    const { data, error } = await supabase
      .from("projects")
      .update(row)
      .eq("legacy_id", project.id)
      .select()
      .single();

    if (error) {
      const status = error.code === "PGRST116" ? 404 : 400;
      return new Response(JSON.stringify({ error: error.message }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, project: rowToClient(data) }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
