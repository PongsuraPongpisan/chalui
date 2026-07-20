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
    const cover = collectProjectPhotos(p)[0] || MOCK_COVER_PHOTO;
    return `
    <div class="admin-queue-card" data-report-id="${p.id}" role="button" tabindex="0">
      <img class="report-card-thumb" src="${cover}" alt="รูปหน้างาน">
      <div class="queue-info">
        <strong>${p.name}</strong>
        <span>${p.roadName || ''} — ${p.contractor}</span>
        <span>สถานะ: ${statusLabelOf(p.status)}</span>
      </div>
    </div>
  `;
  }).join('');

  container.querySelectorAll('[data-report-id]').forEach((card) => {
    card.addEventListener('click', () => openConstructionReportDetail(parseInt(card.dataset.reportId)));
  });
}

function renderConstructionReports() {
  renderWorkLevelOverview();
  renderConstructionReportListOnly();
}

function statusLabelOf(status) {
  const map = { completed: 'เสร็จสิ้น', 'in-progress': 'กำลังทำ', delayed: 'ล่าช้า', planned: 'วางแผน' };
  return map[status] || status;
}

function collectProjectPhotos(project) {
  // Site-overview photos first (contractor's "ภาพหน้างาน" section) — the
  // first one uploaded there is the cover photo, matching the listing-card
  // convention (first photo = cover). Checkpoint photos come after.
  const photos = [];
  if (Array.isArray(project.sitePhotos)) photos.push(...project.sitePhotos);
  if (project.checkpointPhotos && typeof project.checkpointPhotos === 'object') {
    Object.values(project.checkpointPhotos).forEach((arr) => {
      if (Array.isArray(arr)) photos.push(...arr);
    });
  }
  return photos;
}

// Mockup fallback cover photo — used only when a project has no real photos attached.
const MOCK_COVER_PHOTO = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=60&auto=format&fit=crop';

// Labels/icons for the 8 inspection checkpoints (mirrors contractor.astro)
const CHECKPOINT_META = [
  { key: 'cone', num: 1, icon: 'fa-triangle-exclamation', label: 'กรวยจราจร' },
  { key: 'warning_sign', num: 2, icon: 'fa-sign-hanging', label: 'ป้ายเตือน' },
  { key: 'flashing_light', num: 3, icon: 'fa-lightbulb', label: 'ไฟเตือน' },
  { key: 'barrier', num: 4, icon: 'fa-road-barrier', label: 'แผงกั้นเขตก่อสร้าง' },
  { key: 'lane_marking', num: 5, icon: 'fa-road', label: 'เส้นแบ่งช่องทาง' },
  { key: 'speed_limit_sign', num: 6, icon: 'fa-gauge-high', label: 'ป้ายจำกัดความเร็ว' },
  { key: 'detour', num: 7, icon: 'fa-diamond-turn-right', label: 'ทางเบี่ยง' },
  { key: 'construction_zone', num: 8, icon: 'fa-map-location-dot', label: 'เขตก่อสร้าง' },
];

let reportCoverPhotos = [];
let reportCoverIndex = 0;
let reportDetailMap = null;

function renderReportCover() {
  const img = document.getElementById('reportCoverImg');
  const counter = document.getElementById('reportCoverCounter');
  const prevBtn = document.getElementById('reportCoverPrev');
  const nextBtn = document.getElementById('reportCoverNext');
  if (!img || !counter) return;

  const total = reportCoverPhotos.length;
  img.src = total ? reportCoverPhotos[reportCoverIndex] : MOCK_COVER_PHOTO;
  counter.textContent = total ? `${reportCoverIndex + 1}/${total}` : '1/1';
  if (prevBtn) prevBtn.style.display = total > 1 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = total > 1 ? 'flex' : 'none';

  // Highlight the matching thumb in the strip below
  document.querySelectorAll('#reportGalleryStrip img').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === reportCoverIndex);
  });
}

function renderReportGalleryStrip() {
  const strip = document.getElementById('reportGalleryStrip');
  if (!strip) return;
  if (reportCoverPhotos.length <= 1) { strip.innerHTML = ''; return; }
  strip.innerHTML = reportCoverPhotos.map((src, i) =>
    `<img src="${src}" alt="รูปที่ ${i + 1}" data-index="${i}">`
  ).join('');
  strip.querySelectorAll('img').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      reportCoverIndex = Number(thumb.dataset.index);
      renderReportCover();
    });
  });
}

document.getElementById('reportCoverNext')?.addEventListener('click', () => {
  if (reportCoverPhotos.length === 0) return;
  reportCoverIndex = (reportCoverIndex + 1) % reportCoverPhotos.length;
  renderReportCover();
});

document.getElementById('reportCoverPrev')?.addEventListener('click', () => {
  if (reportCoverPhotos.length === 0) return;
  reportCoverIndex = (reportCoverIndex - 1 + reportCoverPhotos.length) % reportCoverPhotos.length;
  renderReportCover();
});

// Clicking the big cover image opens the fullscreen lightbox on the same set
document.getElementById('reportCoverImg')?.addEventListener('click', () => {
  const photos = reportCoverPhotos.length ? reportCoverPhotos : [MOCK_COVER_PHOTO];
  openLightbox(photos, reportCoverIndex);
});

function renderReportCheckpointAlbums(project) {
  const host = document.getElementById('reportCheckpointAlbums');
  if (!host) return;
  const cp = project.checkpointPhotos || {};

  host.innerHTML = CHECKPOINT_META.map((meta) => {
    const photos = Array.isArray(cp[meta.key]) ? cp[meta.key] : [];
    const strip = photos.length
      ? `<div class="checkpoint-album-strip" data-checkpoint-strip="${meta.key}">
           ${photos.map((src, i) => `<img src="${src}" alt="${meta.label}" data-index="${i}">`).join('')}
         </div>`
      : `<div class="checkpoint-album-empty">ไม่มีรูปแนบ</div>`;
    return `
      <div class="checkpoint-album-group">
        <div class="checkpoint-album-title"><span class="checkpoint-num">${meta.num}</span><i class="fa-solid ${meta.icon}"></i> ${meta.label}</div>
        ${strip}
      </div>
    `;
  }).join('');

  // Bind lightbox open for each checkpoint's own photo set (swipeable within that point)
  CHECKPOINT_META.forEach((meta) => {
    const photos = Array.isArray(cp[meta.key]) ? cp[meta.key] : [];
    if (!photos.length) return;
    const strip = host.querySelector(`[data-checkpoint-strip="${meta.key}"]`);
    strip?.querySelectorAll('img').forEach((img) => {
      img.addEventListener('click', () => openLightbox(photos, Number(img.dataset.index)));
    });
  });
}

function renderReportLocationMap(project) {
  const el = document.getElementById('reportDetailMap');
  if (!el || typeof L === 'undefined') return;

  // Destroy any previous map instance before re-initializing (page reused across reports)
  if (reportDetailMap) {
    reportDetailMap.remove();
    reportDetailMap = null;
  }

  const lat = project.lat;
  const lng = project.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    el.innerHTML = '<div class="empty-state">ไม่มีข้อมูลตำแหน่ง GPS</div>';
    return;
  }

  reportDetailMap = L.map(el, { scrollWheelZoom: true }).setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(reportDetailMap);
  L.marker([lat, lng]).addTo(reportDetailMap).bindPopup(project.name);

  // Leaflet needs a resize kick when its container becomes visible after being hidden
  setTimeout(() => reportDetailMap && reportDetailMap.invalidateSize(), 150);
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

  const badge = document.getElementById('reportCoverBadge');
  if (badge) badge.innerHTML = `<i class="fa-solid fa-helmet-safety"></i> ${statusLabelOf(project.status)}`;

  // Cover gallery: site-overview photos only (checkpoint photos have their own albums below)
  reportCoverPhotos = Array.isArray(project.sitePhotos) ? project.sitePhotos : [];
  reportCoverIndex = 0;
  renderReportCover();
  renderReportGalleryStrip();

  renderReportCheckpointAlbums(project);

  // Full-page view (not a popup) — navigates into the report like its own page
  const page = document.getElementById('reportDetailPage');
  page.classList.add('visible');
  page.setAttribute('aria-hidden', 'false');
  page.scrollTop = 0;

  // Map needs the container visible before init, so do it after showing the page
  renderReportLocationMap(project);
}

document.getElementById('closeReportDetail')?.addEventListener('click', () => {
  const page = document.getElementById('reportDetailPage');
  page.classList.remove('visible');
  page.setAttribute('aria-hidden', 'true');
});

// ─── Fullscreen image lightbox (shared by cover gallery + checkpoint albums) ───

let lightboxPhotos = [];
let lightboxIndex = 0;

function openLightbox(photos, startIndex) {
  lightboxPhotos = photos;
  lightboxIndex = startIndex || 0;
  renderLightbox();
  const box = document.getElementById('imageLightbox');
  box.classList.add('visible');
  box.setAttribute('aria-hidden', 'false');
}

function renderLightbox() {
  const img = document.getElementById('lightboxImg');
  const counter = document.getElementById('lightboxCounter');
  if (!img || !counter) return;
  img.src = lightboxPhotos[lightboxIndex];
  counter.textContent = `${lightboxIndex + 1}/${lightboxPhotos.length}`;
}

function closeLightbox() {
  const box = document.getElementById('imageLightbox');
  box.classList.remove('visible');
  box.setAttribute('aria-hidden', 'true');
}

document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
document.getElementById('imageLightbox')?.addEventListener('click', (e) => {
  if (e.target.id === 'imageLightbox') closeLightbox();
});
document.getElementById('lightboxNext')?.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
  renderLightbox();
});
document.getElementById('lightboxPrev')?.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
  renderLightbox();
});
document.addEventListener('keydown', (e) => {
  const box = document.getElementById('imageLightbox');
  if (!box || !box.classList.contains('visible')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') document.getElementById('lightboxNext')?.click();
  if (e.key === 'ArrowLeft') document.getElementById('lightboxPrev')?.click();
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
