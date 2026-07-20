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

function renderWorkLevelOverview() {
  const box = document.getElementById('workLevelOverview');
  if (!box || typeof projects === 'undefined' || typeof WORK_LEVEL_META === 'undefined') return;
  const meta = WORK_LEVEL_META;
  const levels = Object.keys(meta).sort((a, b) => meta[a].order - meta[b].order);
  box.innerHTML = levels.map((lvl) => {
    const m = meta[lvl];
    const items = projects.filter((p) => (p.workLevel || 'medium') === lvl);
    const active = items.filter((p) => p.status === 'in-progress' || p.status === 'delayed').length;
    const isActive = activeWorkLevelFilter === lvl;
    return `<button type="button" class="work-level-chip" data-level="${lvl}" title="${m.desc}" style="text-align:left;border:1px solid ${m.color}33;border-left:4px solid ${m.color};background:${isActive ? m.color + '26' : m.color + '0d'};border-radius:12px;padding:10px 12px;cursor:pointer;transition:transform .12s">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span style="font-size:0.72rem;font-weight:700;color:${m.color}">${m.icon} ${m.code}</span>
        <span style="font-size:1.4rem;font-weight:800;color:${m.color};line-height:1">${items.length}</span>
      </div>
      <div style="font-size:0.92rem;font-weight:700;color:#1f2937;margin-top:2px">${m.label}</div>
      <div style="font-size:0.68rem;color:#68746f;margin-top:2px">${m.audit}</div>
      <div style="font-size:0.66rem;color:#94a3b8;margin-top:4px">กำลังทำ/ล่าช้า ${active} งาน</div>
    </button>`;
  }).join('');
  box.querySelectorAll('.work-level-chip').forEach((chip) => {
    chip.addEventListener('mouseenter', () => (chip.style.transform = 'translateY(-2px)'));
    chip.addEventListener('mouseleave', () => (chip.style.transform = 'none'));
    chip.addEventListener('click', () => {
      // Toggle filter: tapping the same level again clears the filter
      activeWorkLevelFilter = activeWorkLevelFilter === chip.dataset.level ? null : chip.dataset.level;
      renderWorkLevelOverview();
      renderConstructionReportListOnly();
    });
  });
}

function renderConstructionReportListOnly() {
  const container = document.getElementById('constructionReportList');
  if (!container) return;
  if (typeof projects === 'undefined' || projects.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีรายงานก่อสร้าง</div>';
    return;
  }

  const list = activeWorkLevelFilter
    ? projects.filter((p) => (p.workLevel || 'medium') === activeWorkLevelFilter)
    : projects;

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มีรายงานในระดับนี้</div>';
    return;
  }

  container.innerHTML = list.map((p) => {
    const cover = Array.isArray(p.sitePhotos) && p.sitePhotos[0] ? p.sitePhotos[0] : MOCK_COVER_PHOTO;
    const reportId = encodeURIComponent(String(p.id));
    const levelKey = WORK_LEVEL_META[p.workLevel] ? p.workLevel : 'medium';
    const level = WORK_LEVEL_META[levelKey];
    return `
    <a class="admin-queue-card admin-report-link" href="/admin/reports/${reportId}">
      <img class="report-card-thumb" src="${cover}" alt="รูปหน้างาน">
      <div class="queue-info">
        <strong>${p.name}</strong>
        <span>${p.roadName || ''} — ${p.contractor}</span>
        <span>สถานะ: ${statusLabelOf(p.status)}</span>
      </div>
      <span class="construction-level-badge level-${levelKey}">${level.icon} ${level.code} · ${level.label}</span>
    </a>
  `;
  }).join('');
}

function renderConstructionReports() {
  renderWorkLevelOverview();
  renderConstructionReportListOnly();
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
    return `
      <div class="admin-queue-card" data-company="${encodeURIComponent(c.name)}" role="button" tabindex="0">
        <div class="queue-info">
          <strong>${c.name}</strong>
          <span>โครงการที่กำลังดำเนินการ: ${active} | ทั้งหมด: ${c.projects.length}</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-company]').forEach((card) => {
    card.addEventListener('click', () => openCompanyDetail(decodeURIComponent(card.dataset.company)));
  });
}

function openCompanyDetail(companyName) {
  const companyProjects = typeof projects !== 'undefined' ? projects.filter((p) => p.contractor === companyName) : [];
  const active = companyProjects.filter((p) => p.status === 'in-progress' || p.status === 'delayed').length;

  document.getElementById('companyDetailName').textContent = companyName;
  document.getElementById('companyDetailTotal').textContent = companyProjects.length;
  document.getElementById('companyDetailActive').textContent = active;

  const listHost = document.getElementById('companyDetailProjects');
  listHost.innerHTML = companyProjects.map((p) => `
    <div class="admin-queue-card">
      <div class="queue-info">
        <strong>${p.name}</strong>
        <span>${p.roadName || ''}</span>
        <span>สถานะ: ${statusLabelOf(p.status)}</span>
      </div>
    </div>
  `).join('');

  const modal = document.getElementById('companyDetailModal');
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
}

document.getElementById('closeCompanyDetail')?.addEventListener('click', () => {
  const modal = document.getElementById('companyDetailModal');
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
});

// Expose
window.AdminModule = { renderConstructionReports, renderCitizenReports, renderCompanyList };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
