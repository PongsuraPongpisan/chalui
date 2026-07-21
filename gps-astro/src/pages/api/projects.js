import { supabase } from "../../lib/supabase.js";
import { clientToRow, rowToClient } from "../../lib/project-mapper.js";
import { getSession } from "../../lib/session.js";

export const prerender = false;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function getEditor(cookies) {
  const session = getSession(cookies);
  return session && (session.role === "admin" || session.role === "contractor") ? session : null;
}

function canModify(session, row) {
  if (session.role === "admin") return true;
  return Boolean(row.extra?.ownerUsername) && row.extra.ownerUsername === session.username;
}

export async function GET({ cookies }) {
  const session = getSession(cookies);
  let query = supabase
    .from("projects")
    .select("*")
    .order("legacy_id", { ascending: true });

  // "My Projects" must only expose projects owned by the signed-in contractor.
  if (session?.role === "contractor") {
    query = query.contains("extra", { ownerUsername: session.username });
  }

  const { data, error } = await query;

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

export async function POST({ request, cookies }) {
  const session = getEditor(cookies);
  if (!session) return json({ error: "Unauthorized" }, 401);

  try {
    const project = await request.json();
    const row = clientToRow(project);
    const requestedId = Number(project.id);
    const needsServerId = session.role === "contractor" || !Number.isSafeInteger(requestedId) || requestedId < 1;
    if (needsServerId) {
      const { data: latest, error: idError } = await supabase
        .from("projects")
        .select("legacy_id")
        .order("legacy_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (idError) return json({ error: idError.message }, 500);
      row.legacy_id = Number(latest?.legacy_id || 0) + 1;
    } else {
      row.legacy_id = requestedId;
    }
    if (session.role === "contractor") {
      row.contractor = "User submitted";
      row.extra = { ...(row.extra || {}), ownerUsername: session.username };
    }

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

export async function PUT({ request, cookies }) {
  const session = getEditor(cookies);
  if (!session) return json({ error: "Unauthorized" }, 401);

  try {
    const project = await request.json();
    if (project.id === undefined) {
      return new Response(JSON.stringify({ error: "Missing project id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Merge extra fields with the existing row's extra instead of overwriting it,
    // so partial updates don't wipe photos or ownership metadata.
    const { data: existing, error: existingError } = await supabase
      .from("projects")
      .select("contractor, extra")
      .eq("legacy_id", project.id)
      .single();

    if (existingError || !existing) return json({ error: "Project not found" }, 404);
    if (!canModify(session, existing)) return json({ error: "Forbidden" }, 403);

    const row = clientToRow(project);
    if (row.extra && existing.extra) {
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

export async function DELETE({ request, cookies }) {
  const session = getEditor(cookies);
  if (!session) return json({ error: "Unauthorized" }, 401);

  try {
    const { id } = await request.json();
    if (id === undefined) return json({ error: "Missing project id" }, 400);

    const { data: existing, error: existingError } = await supabase
      .from("projects")
      .select("contractor, extra")
      .eq("legacy_id", id)
      .single();

    if (existingError || !existing) return json({ error: "Project not found" }, 404);
    if (!canModify(session, existing)) return json({ error: "Forbidden" }, 403);

    const { error } = await supabase.from("projects").delete().eq("legacy_id", id);
    if (error) return json({ error: error.message }, 400);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 400);
  }
}
