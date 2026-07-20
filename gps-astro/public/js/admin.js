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

function renderConstructionReports() {
  const container = document.getElementById('constructionReportList');
  if (!container) return;
  if (typeof projects === 'undefined' || projects.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีรายงานก่อสร้าง</div>';
    return;
  }

  container.innerHTML = projects.map((p) => `
    <div class="admin-queue-card" data-report-id="${p.id}" role="button" tabindex="0">
      <div class="queue-info">
        <strong>${p.name}</strong>
        <span>${p.roadName || ''} — ${p.contractor}</span>
        <span>สถานะ: ${statusLabelOf(p.status)}</span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-report-id]').forEach((card) => {
    card.addEventListener('click', () => openConstructionReportDetail(parseInt(card.dataset.reportId)));
  });
}

function statusLabelOf(status) {
  const map = { completed: 'เสร็จสิ้น', 'in-progress': 'กำลังทำ', delayed: 'ล่าช้า', planned: 'วางแผน' };
  return map[status] || status;
}

function collectProjectPhotos(project) {
  const photos = [];
  if (Array.isArray(project.sitePhotos)) photos.push(...project.sitePhotos);
  if (project.checkpointPhotos && typeof project.checkpointPhotos === 'object') {
    Object.values(project.checkpointPhotos).forEach((arr) => {
      if (Array.isArray(arr)) photos.push(...arr);
    });
  }
  return photos;
}

function openConstructionReportDetail(projectId) {
  const project = typeof projects !== 'undefined' ? projects.find((p) => p.id === projectId) : null;
  if (!project) return;

  document.getElementById('reportDetailName').textContent = project.name;
  document.getElementById('reportDetailContractor').textContent = project.contractor || '-';
  document.getElementById('reportDetailRoad').textContent = project.roadName || '-';
  document.getElementById('reportDetailGps').textContent = `${project.lat.toFixed(6)}, ${project.lng.toFixed(6)}`;
  document.getElementById('reportDetailStatus').textContent = statusLabelOf(project.status);
  document.getElementById('reportDetailStart').textContent = project.start ? new Date(project.start).toLocaleString('th-TH') : '-';
  document.getElementById('reportDetailEnd').textContent = project.end ? new Date(project.end).toLocaleString('th-TH') : '-';
  document.getElementById('reportDetailNote').textContent = project.statusNote || '-';

  const photos = collectProjectPhotos(project);
  const photoHost = document.getElementById('reportDetailPhotos');
  photoHost.innerHTML = photos.length
    ? photos.map((src) => `<img class="detail-photo" src="${src}" alt="รูปหน้างาน">`).join('')
    : '<div class="empty-state" style="padding:12px">ไม่มีรูปแนบ</div>';

  const modal = document.getElementById('reportDetailModal');
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
}

document.getElementById('closeReportDetail')?.addEventListener('click', () => {
  const modal = document.getElementById('reportDetailModal');
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
});

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
