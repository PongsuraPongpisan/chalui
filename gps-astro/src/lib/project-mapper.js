const COLUMN_MAP = {
  name: "name", province: "province", contractor: "contractor", status: "status",
  workLevel: "work_level", roadName: "road_name", lat: "lat", lng: "lng",
  radiusKm: "radius_km", boundaryMeters: "boundary_meters", start: "start_date",
  end: "end_date", aiVerdict: "ai_verdict", aiConfidence: "ai_confidence",
  aiScore: "ai_score", complianceVerdict: "compliance_verdict",
  complianceScore: "compliance_score", complianceReportId: "compliance_report_id",
  adminDecision: "admin_decision", verified: "verified", aiWasWrong: "ai_was_wrong",
  publishedToDrivers: "published_to_drivers", isDangerous: "is_dangerous",
  needsDohInspection: "needs_doh_inspection", needsReaudit: "needs_reaudit",
  rejectReason: "reject_reason", overrideReason: "override_reason",
  lastAuditAt: "last_audit_at", validatedBy: "validated_by", validatedAt: "validated_at",
  adminApprovalStatus: "admin_approval_status",
  adminRejectionReason: "admin_rejection_reason",
  adminDecidedBy: "admin_decided_by", adminDecidedAt: "admin_decided_at",
};

const RESERVED_APPROVAL_FIELDS = new Set([
  "adminApprovalStatus", "adminRejectionReason", "adminDecidedBy", "adminDecidedAt",
]);

const REVERSE_MAP = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([clientKey, dbKey]) => [dbKey, clientKey])
);

export function rowToClient(row) {
  const client = { id: row.legacy_id };
  for (const [dbKey, clientKey] of Object.entries(REVERSE_MAP)) {
    if (row[dbKey] !== undefined) client[clientKey] = row[dbKey];
  }
  if (row.extra && typeof row.extra === "object") {
    for (const [key, value] of Object.entries(row.extra)) {
      if (key !== "id" && !Object.hasOwn(COLUMN_MAP, key)) client[key] = value;
    }
  }
  return client;
}

export function clientToRow(project) {
  const row = {};
  const extra = {};
  for (const [clientKey, value] of Object.entries(project)) {
    if (clientKey === "id" || RESERVED_APPROVAL_FIELDS.has(clientKey)) continue;
    if (COLUMN_MAP[clientKey]) row[COLUMN_MAP[clientKey]] = value;
    else extra[clientKey] = value;
  }
  if (Object.keys(extra).length > 0) row.extra = extra;
  return row;
}
