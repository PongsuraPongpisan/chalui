/**
 * Admin Module — Construction reports, Citizen reports, Company directory
 */

function initAdmin() {
  // Render on nav click (Astro multi-page: admin page has its own nav)
  document.querySelector('[data-nav="admin"]')?.addEventListener('click', () => {
    setTimeout(renderConstructionReports, 100);
  });
}

// ─── Section 1: Construction Reports (from contractors) ───

let activeWorkLevelFilter = null;

function approvalStatusOf(project) {
  return project?.adminApprovalStatus === 'approved' ? 'approved' : 'pending';
}

function approvalBadge(status) {
  const meta = {
    pending: { icon: 'fa-clock', label: 'รออนุมัติ' },
    approved: { icon: 'fa-circle-check', label: 'อนุมัติแล้ว / Approved' },
  }[status];
  return `<span class="admin-approval-badge approval-${status}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function renderWorkLevelOverview() {
  const box = document.getElementById('workLevelOverview');
  if (!box || typeof projects === 'undefined' || typeof WORK_LEVEL_META === 'undefined') return;
  const meta = WORK_LEVEL_META;
  const reviewProjects = projects.filter((p) => approvalStatusOf(p) !== 'approved');
  const levels = Object.keys(meta).sort((a, b) => meta[a].order - meta[b].order);
  box.innerHTML = levels.map((lvl) => {
    const m = meta[lvl];
    const items = reviewProjects.filter((p) => (p.workLevel || 'medium') === lvl);
    const active = items.filter((p) => p.status === 'in-progress' || p.status === 'delayed').length;
    const isActive = activeWorkLevelFilter === lvl;
    return `<button type="button" class="construction-level-option level-${lvl} work-level-chip${isActive ? ' is-selected' : ''}" data-level="${lvl}" title="${m.desc}" aria-pressed="${isActive}">
      <span class="construction-level-option-head">
        <span class="level-color-dot"></span>
        <span>${m.code}</span>
        <span class="admin-work-level-count">${items.length}</span>
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
      </span>
      <strong>${m.label}</strong>
      <small>${m.audit}</small>
      <small class="admin-work-level-summary">กำลังทำ/ล่าช้า ${active} งาน</small>
    </button>`;
  }).join('');
  box.querySelectorAll('.work-level-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeWorkLevelFilter = activeWorkLevelFilter === chip.dataset.level ? null : chip.dataset.level;
      renderWorkLevelOverview();
      renderConstructionReportListOnly();
    });
  });
}

function renderProjectCard(p, approved = false) {
  const cover = Array.isArray(p.sitePhotos) && p.sitePhotos[0] ? p.sitePhotos[0] : MOCK_COVER_PHOTO;
  const reportId = encodeURIComponent(String(p.id));
  const levelKey = WORK_LEVEL_META[p.workLevel] ? p.workLevel : 'medium';
  const level = WORK_LEVEL_META[levelKey];
  const approval = approvalStatusOf(p);
  const suffix = approved ? '?from=approved' : '';
  return `
    <a class="admin-queue-card admin-report-link${approved ? ' approved-report-card' : ''}" href="/admin/reports/${reportId}${suffix}">
      <img class="report-card-thumb" src="${cover}" alt="รูปหน้างาน">
      <div class="queue-info">
        <strong>${p.name}</strong>
        <span>${typeof displayPlaceName === 'function' ? displayPlaceName(p.roadName) : (p.roadName || '')} — ${p.contractor}</span>
      </div>
      <div class="admin-report-card-footer">
        <span class="admin-report-status">สถานะ: ${statusLabelOf(p.status)}</span>
        ${approvalBadge(approval)}
        <span class="construction-level-badge level-${levelKey}">${level.icon} ${level.code} · ${level.label}</span>
      </div>
    </a>`;
}

function renderConstructionReportListOnly() {
  const container = document.getElementById('constructionReportList');
  if (!container) return;
  const reviewProjects = typeof projects === 'undefined'
    ? []
    : projects.filter((p) => approvalStatusOf(p) !== 'approved');
  const list = activeWorkLevelFilter
    ? reviewProjects.filter((p) => (p.workLevel || 'medium') === activeWorkLevelFilter)
    : reviewProjects;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">${activeWorkLevelFilter ? 'ไม่มีรายงานในระดับนี้' : 'ไม่มีรายงานที่รอตรวจสอบ'}</div>`;
    return;
  }
  container.innerHTML = list.map((p) => renderProjectCard(p)).join('');
}

function renderApprovedReports() {
  const container = document.getElementById('approvedReportList');
  if (!container) return;
  const list = typeof projects === 'undefined'
    ? []
    : projects.filter((p) => approvalStatusOf(p) === 'approved');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีงานที่อนุมัติแล้ว</div>';
    return;
  }
  list.sort((a, b) => new Date(b.adminDecidedAt || 0) - new Date(a.adminDecidedAt || 0));
  container.innerHTML = list.map((p) => renderProjectCard(p, true)).join('');
}

function renderConstructionReports() {
  renderWorkLevelOverview();
  renderConstructionReportListOnly();
  renderApprovedReports();
}

function statusLabelOf(status) {
  const map = { completed: 'เสร็จสิ้น', 'in-progress': 'กำลังทำ', delayed: 'ล่าช้า', planned: 'วางแผน' };
  return map[status] || status;
}

// Mockup fallback cover photo — used only when a project has no real photos attached.
const MOCK_COVER_PHOTO = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=60&auto=format&fit=crop';

// Construction report interaction now lives on /admin/reports/:id.

// ─── Section 2: Citizen Reports (feedback + reports panel submissions) ───

function renderCitizenReports() {
  const container = document.getElementById('citizenReportList');
  if (!container) return;

  const feedbackList = window.FeedbackModule ? window.FeedbackModule.getFeedbackList() : [];
  const reportList = typeof reports !== 'undefined' ? reports : [];

  if (feedbackList.length === 0 && reportList.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีรายงานจากประชาชน</div>';
    return;
  }

  const feedbackCards = feedbackList.map((fb) => {
    const type = window.FeedbackModule.PROBLEM_TYPES[fb.problemType] || { label: fb.problemType };
    return `
      <div class="admin-queue-card" data-citizen-kind="feedback" data-citizen-id="${fb.id}" role="button" tabindex="0">
        <div class="queue-info">
          <strong>${type.label}</strong>
          <span>${fb.zoneName || 'ไม่ระบุ zone'} — ${new Date(fb.createdAt).toLocaleString('th-TH')}</span>
        </div>
      </div>
    `;
  }).join('');

  const reportCards = reportList.map((r) => `
      <div class="admin-queue-card" data-citizen-kind="report" data-citizen-id="${r.id}" role="button" tabindex="0">
        <div class="queue-info">
          <strong>${r.title}</strong>
          <span>${r.type} — ${new Date(r.timestamp).toLocaleString('th-TH')}</span>
        </div>
      </div>
  `).join('');

  container.innerHTML = feedbackCards + reportCards;

  container.querySelectorAll('[data-citizen-kind]').forEach((card) => {
    card.addEventListener('click', () => {
      const kind = card.dataset.citizenKind;
      const id = card.dataset.citizenId;
      if (kind === 'feedback') {
        const fb = feedbackList.find((f) => String(f.id) === id);
        if (fb) openCitizenFeedbackDetail(fb);
      } else {
        const r = reportList.find((x) => String(x.id) === id);
        if (r) openCitizenReportDetail(r);
      }
    });
  });
}

function openCitizenFeedbackDetail(fb) {
  const type = window.FeedbackModule.PROBLEM_TYPES[fb.problemType] || { label: fb.problemType };
  document.getElementById('citizenDetailTitle').textContent = type.label;
  document.getElementById('citizenDetailType').textContent = type.label;
  document.getElementById('citizenDetailDescription').textContent = fb.description || '-';
  document.getElementById('citizenDetailZone').textContent = fb.zoneName || 'ไม่ระบุ';
  document.getElementById('citizenDetailGps').textContent = (fb.lat && fb.lng) ? `${fb.lat.toFixed(6)}, ${fb.lng.toFixed(6)}` : '-';
  document.getElementById('citizenDetailTime').textContent = new Date(fb.createdAt).toLocaleString('th-TH');
  document.getElementById('citizenDetailReporter').textContent = fb.contractorName || 'ไม่ระบุ';

  const photoHost = document.getElementById('citizenDetailPhotos');
  photoHost.innerHTML = fb.photoUrl
    ? `<img class="detail-photo" src="${fb.photoUrl}" alt="รูปแนบ">`
    : '<div class="empty-state" style="padding:12px">ไม่มีรูปแนบ</div>';

  showCitizenDetailModal();
}

function openCitizenReportDetail(r) {
  document.getElementById('citizenDetailTitle').textContent = r.title;
  document.getElementById('citizenDetailType').textContent = r.type;
  document.getElementById('citizenDetailDescription').textContent = r.description || '-';
  document.getElementById('citizenDetailZone').textContent = '-';
  document.getElementById('citizenDetailGps').textContent = (r.lat && r.lng) ? `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}` : '-';
  document.getElementById('citizenDetailTime').textContent = new Date(r.timestamp).toLocaleString('th-TH');
  document.getElementById('citizenDetailReporter').textContent = r.reporter || 'ไม่ระบุ';

  const photoHost = document.getElementById('citizenDetailPhotos');
  photoHost.innerHTML = r.image
    ? `<img class="detail-photo" src="${r.image}" alt="รูปแนบ">`
    : '<div class="empty-state" style="padding:12px">ไม่มีรูปแนบ</div>';

  showCitizenDetailModal();
}

function showCitizenDetailModal() {
  const modal = document.getElementById('citizenDetailModal');
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
}

document.getElementById('closeCitizenDetail')?.addEventListener('click', () => {
  const modal = document.getElementById('citizenDetailModal');
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
});

// ─── Section 3: Company Directory ───

function renderCompanyList() {
  const container = document.getElementById('companyList');
  if (!container) return;
  if (typeof projects === 'undefined' || projects.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มีข้อมูลบริษัท</div>';
    return;
  }

  const companies = {};
  projects.forEach((p) => {
    if (!companies[p.contractor]) {
      companies[p.contractor] = { name: p.contractor, projects: [] };
    }
    companies[p.contractor].projects.push(p);
  });

  const entries = Object.values(companies);
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มีข้อมูลบริษัท</div>';
    return;
  }

  container.innerHTML = entries.map((c) => {
    const active = c.projects.filter((p) => p.status === 'in-progress' || p.status === 'delayed').length;
    const companyUrl = `/admin/companies/${encodeURIComponent(c.name)}`;
    return `
      <a class="admin-queue-card company-list-link" href="${companyUrl}">
        <span class="company-list-icon" aria-hidden="true"><i class="fa-solid fa-building"></i></span>
        <div class="queue-info">
          <strong>${c.name}</strong>
          <span>โครงการที่กำลังดำเนินการ: ${active} | ทั้งหมด: ${c.projects.length}</span>
        </div>
        <i class="fa-solid fa-chevron-right company-list-arrow" aria-hidden="true"></i>
      </a>
    `;
  }).join('');
}

// Expose
window.AdminModule = { renderConstructionReports, renderCitizenReports, renderCompanyList };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
