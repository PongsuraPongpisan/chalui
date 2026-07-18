import { supabase } from "../../lib/supabase.js";

export const prerender = false;

// Columns that map 1:1 (snake_case DB -> camelCase client) with a simple rename.
// Anything the client sends that isn't in this list gets stored in the
// `extra` jsonb column instead of growing the schema for every UI field.
const COLUMN_MAP = {
  name: "name",
  province: "province",
  contractor: "contractor",
  status: "status",
  workLevel: "work_level",
  roadName: "road_name",
  lat: "lat",
  lng: "lng",
  radiusKm: "radius_km",
  boundaryMeters: "boundary_meters",
  start: "start_date",
  end: "end_date",
  aiVerdict: "ai_verdict",
  aiConfidence: "ai_confidence",
  aiScore: "ai_score",
  complianceVerdict: "compliance_verdict",
  complianceScore: "compliance_score",
  complianceReportId: "compliance_report_id",
  adminDecision: "admin_decision",
  verified: "verified",
  aiWasWrong: "ai_was_wrong",
  publishedToDrivers: "published_to_drivers",
  isDangerous: "is_dangerous",
  needsDohInspection: "needs_doh_inspection",
  needsReaudit: "needs_reaudit",
  rejectReason: "reject_reason",
  overrideReason: "override_reason",
  lastAuditAt: "last_audit_at",
  validatedBy: "validated_by",
  validatedAt: "validated_at",
};

const REVERSE_MAP = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([clientKey, dbKey]) => [dbKey, clientKey])
);

// Fields the client sends that don't have a dedicated column (workType,
// timestamp, photoTheme, photoColors, statusNote, ...) get folded into `extra`.
function rowToClient(row) {
  const client = { id: row.legacy_id };
  for (const [dbKey, clientKey] of Object.entries(REVERSE_MAP)) {
    if (row[dbKey] !== undefined) client[clientKey] = row[dbKey];
  }
  if (row.extra && typeof row.extra === "object") {
    Object.assign(client, row.extra);
  }
  return client;
}

function clientToRow(project) {
  const row = {};
  const extra = {};
  for (const [clientKey, value] of Object.entries(project)) {
    if (clientKey === "id") continue;
    if (COLUMN_MAP[clientKey]) {
      row[COLUMN_MAP[clientKey]] = value;
    } else {
      extra[clientKey] = value;
    }
  }
  if (Object.keys(extra).length > 0) row.extra = extra;
  return row;
}

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
