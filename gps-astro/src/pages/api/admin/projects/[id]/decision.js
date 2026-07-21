import { supabase } from "../../../../../lib/supabase.js";
import { rowToClient } from "../../../../../lib/project-mapper.js";
import { getSession } from "../../../../../lib/session.js";

export const prerender = false;

const VALID_DECISIONS = new Set(["approved", "rejected"]);
const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function PATCH({ params, request, cookies }) {
  const session = getSession(cookies);
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (session.role !== "admin") return json({ error: "Forbidden" }, 403);

  const idText = String(params.id || "");
  const id = Number(idText);
  if (!/^\d+$/.test(idText) || !Number.isSafeInteger(id) || id < 1) {
    return json({ error: "Invalid project id" }, 400);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }
  const decision = String(body?.decision || "");
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!VALID_DECISIONS.has(decision)) return json({ error: "Invalid approval decision" }, 400);
  if (decision === "rejected" && !reason) return json({ error: "กรุณาระบุเหตุผลที่ไม่อนุมัติ" }, 400);
  if (reason.length > 1000) return json({ error: "Rejection reason is too long" }, 400);

  const { data: existing, error: readError } = await supabase.from("projects")
    .select("legacy_id, status, admin_approval_status").eq("legacy_id", id).maybeSingle();
  if (readError) return json({ error: readError.message }, 500);
  if (!existing) return json({ error: "Project not found" }, 404);
  if ((existing.admin_approval_status || "pending") !== "pending") {
    return json({ error: "This project already has a final approval decision" }, 409);
  }
  if (existing.status !== "completed") {
    return json({ error: "ไม่สามารถอนุมัติหรือไม่อนุมัติได้ เนื่องจากงานยังไม่อยู่ในสถานะเสร็จสิ้น" }, 409);
  }

  const update = {
    admin_approval_status: decision,
    admin_rejection_reason: decision === "rejected" ? reason : null,
    admin_decided_by: String(session.username || "admin"),
    admin_decided_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("projects").update(update)
    .eq("legacy_id", id).eq("admin_approval_status", "pending").eq("status", "completed")
    .select("*").maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) {
    return json({ error: "ไม่สามารถบันทึกผลได้ โปรดตรวจสอบว่างานเสร็จสิ้นและยังไม่มีผลตัดสิน" }, 409);
  }
  return json({ success: true, project: rowToClient(data) });
}
