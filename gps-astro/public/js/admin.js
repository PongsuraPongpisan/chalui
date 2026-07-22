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
let activeWorkStatusFilter = 'all';

const ADMIN_WORK_STATUS_META = {
  all: { label: 'ทั้งหมด', icon: 'fa-layer-group' },
  planned: { label: 'วางแผน', icon: 'fa-calendar-days' },
  'in-progress': { label: 'กำลังทำ', icon: 'fa-person-digging' },
  delayed: { label: 'ล่าช้า', icon: 'fa-triangle-exclamation' },
  completed: { label: 'เสร็จสิ้น', icon: 'fa-circle-check' },
};

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

function reviewProjects() {
  return typeof projects === 'undefined'
    ? []
    : projects.filter((project) => approvalStatusOf(project) !== 'approved');
}

function workStatusBadge(status) {
  const key = ADMIN_WORK_STATUS_META[status] ? status : 'planned';
  const meta = ADMIN_WORK_STATUS_META[key];
  return `<span class="admin-work-status-badge work-status-${key}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>`;
}

function renderWorkStatusFilters() {
  const reportList = document.getElementById('constructionReportList');
  if (!reportList) return;
  let host = document.getElementById('adminWorkStatusFilters');
  if (!host) {
    host = document.createElement('div');
    host.id = 'adminWorkStatusFilters';
    host.className = 'admin-work-status-filter';
    reportList.before(host);
  }

  const allReviewProjects = reviewProjects();
  const countSource = activeWorkLevelFilter
    ? allReviewProjects.filter((project) => (project.workLevel || 'medium') === activeWorkLevelFilter)
    : allReviewProjects;
  host.innerHTML = `
    <span class="admin-work-status-filter-title"><i class="fa-solid fa-filter"></i> กรองตามสถานะงาน</span>
    <div class="admin-work-status-filter-list" role="tablist" aria-label="กรองรายงานตามสถานะงาน">
      ${Object.entries(ADMIN_WORK_STATUS_META).map(([key, meta]) => {
        const count = key === 'all' ? countSource.length : countSource.filter((project) => project.status === key).length;
        const active = activeWorkStatusFilter === key;
        return `<button type="button" class="admin-status-filter-btn work-status-${key}${active ? ' active' : ''}" data-work-status="${key}" role="tab" aria-selected="${active}">
          <i class="fa-solid ${meta.icon}"></i><span>${meta.label}</span><strong>${count}</strong>
        </button>`;
      }).join('')}
    </div>`;
  host.querySelectorAll('[data-work-status]').forEach((button) => {
    button.addEventListener('click', () => {
      activeWorkStatusFilter = button.dataset.workStatus || 'all';
      renderWorkStatusFilters();
      renderWorkLevelOverview();
      renderConstructionReportListOnly();
    });
  });
}

function renderWorkLevelOverview() {
  const box = document.getElementById('workLevelOverview');
  if (!box || typeof WORK_LEVEL_META === 'undefined') return;
  const meta = WORK_LEVEL_META;
  const statusFilteredProjects = activeWorkStatusFilter === 'all'
    ? reviewProjects()
    : reviewProjects().filter((project) => project.status === activeWorkStatusFilter);
  const levels = Object.keys(meta).sort((a, b) => meta[a].order - meta[b].order);
  box.innerHTML = levels.map((lvl) => {
    const m = meta[lvl];
    const items = statusFilteredProjects.filter((p) => (p.workLevel || 'medium') === lvl);
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
      renderWorkStatusFilters();
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
        ${workStatusBadge(p.status)}
        ${approvalBadge(approval)}
        <span class="construction-level-badge level-${levelKey}">${level.icon} ${level.code} · ${level.label}</span>
      </div>
    </a>`;
}

function renderConstructionReportListOnly() {
  const container = document.getElementById('constructionReportList');
  if (!container) return;
  let list = reviewProjects();
  if (activeWorkLevelFilter) {
    list = list.filter((project) => (project.workLevel || 'medium') === activeWorkLevelFilter);
  }
  if (activeWorkStatusFilter !== 'all') {
    list = list.filter((project) => project.status === activeWorkStatusFilter);
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มีรายงานที่ตรงกับตัวกรองนี้</div>';
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
  renderWorkStatusFilters();
  renderWorkLevelOverview();
  renderConstructionReportListOnly();
  renderApprovedReports();
}

function statusLabelOf(status) {
  return ADMIN_WORK_STATUS_META[status]?.label || status;
}

// Mockup fallback cover photo — used only when a project has no real photos attached.
const MOCK_COVER_PHOTO = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=60&auto=format&fit=crop';

// Construction report interaction now lives on /admin/reports/:id.

// ─── Section 2: Citizen Reports (feedback + reports panel submissions) ───

let citizenDetailMap = null;
let citizenGalleryPhotos = [];
let citizenGalleryIndex = 0;
let citizenLightboxIndex = 0;

function formatCitizenReportDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('th-TH-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

function escapeCitizenHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function safeCitizenImageSource(value) {
  const source = typeof value === 'string' ? value.trim() : '';
  return /^(data:image\/|https?:\/\/|blob:|\/)/i.test(source) ? source : '';
}

function citizenImagesOf(item) {
  let images = Array.isArray(item?.images) && item.images.length
    ? item.images
    : (Array.isArray(item?.photoUrls) && item.photoUrls.length ? item.photoUrls : []);
  const legacyImage = item?.image || item?.photoUrl;
  if (!images.length && typeof legacyImage === 'string' && legacyImage) {
    try {
      const parsed = JSON.parse(legacyImage);
      images = Array.isArray(parsed) ? parsed : [legacyImage];
    } catch {
      images = [legacyImage];
    }
  }
  return images.map(safeCitizenImageSource).filter(Boolean);
}

function renderCitizenReports() {
  const container = document.getElementById('citizenReportList');
  if (!container) return;

  const feedbackList = window.FeedbackModule ? window.FeedbackModule.getFeedbackList() : [];
  const reportList = typeof reports !== 'undefined' ? reports : [];
  const persistedIds = new Set(reportList.map((report) => `fb-${report.id}`));
  const entries = reportList.map((report) => ({
    kind: 'report',
    id: report.id,
    subject: report.title || 'ไม่มีหัวข้อ',
    timestamp: report.timestamp,
    photos: citizenImagesOf(report),
    item: report,
  }));

  feedbackList
    .filter((feedback) => !persistedIds.has(String(feedback.id)))
    .forEach((feedback) => {
      const type = window.FeedbackModule.PROBLEM_TYPES[feedback.problemType] || { label: feedback.problemType };
      entries.push({
        kind: 'feedback',
        id: feedback.id,
        subject: type.label || 'รายงานจากประชาชน',
        timestamp: feedback.createdAt,
        photos: citizenImagesOf(feedback),
        item: feedback,
      });
    });

  entries.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีรายงานจากประชาชน</div>';
    return;
  }

  container.innerHTML = entries.map((entry) => {
    const thumbnail = entry.photos[0];
    const media = thumbnail
      ? `<img src="${escapeCitizenHtml(thumbnail)}" alt="รูปประกอบ ${escapeCitizenHtml(entry.subject)}" loading="lazy">`
      : '<span class="admin-citizen-card-placeholder"><i class="fa-solid fa-image"></i></span>';
    const photoCount = entry.photos.length > 1
      ? `<span class="admin-citizen-photo-count"><i class="fa-solid fa-images"></i> ${entry.photos.length}</span>`
      : '';
    return `
      <button class="admin-citizen-card" type="button" data-citizen-kind="${entry.kind}" data-citizen-id="${escapeCitizenHtml(entry.id)}">
        <span class="admin-citizen-card-media">${media}${photoCount}</span>
        <span class="admin-citizen-card-body">
          <small>หัวข้อ</small>
          <strong>${escapeCitizenHtml(entry.subject)}</strong>
          <time datetime="${escapeCitizenHtml(entry.timestamp || '')}"><i class="fa-regular fa-clock"></i> ${formatCitizenReportDateTime(entry.timestamp)}</time>
        </span>
        <i class="fa-solid fa-chevron-right admin-citizen-card-arrow" aria-hidden="true"></i>
      </button>`;
  }).join('');

  container.querySelectorAll('[data-citizen-kind]').forEach((card) => {
    card.addEventListener('click', () => {
      const entry = entries.find((candidate) => candidate.kind === card.dataset.citizenKind
        && String(candidate.id) === card.dataset.citizenId);
      if (!entry) return;
      if (entry.kind === 'feedback') openCitizenFeedbackDetail(entry.item);
      else openCitizenReportDetail(entry.item);
    });
  });
}

function ensureCitizenDetailUi() {
  const photoHost = document.getElementById('citizenDetailPhotos');
  if (!photoHost) return;
  photoHost.className = 'citizen-detail-gallery';

  if (!document.getElementById('citizenDetailMapSection')) {
    const mapSection = document.createElement('section');
    mapSection.id = 'citizenDetailMapSection';
    mapSection.className = 'citizen-detail-map-section';
    mapSection.innerHTML = '<h3><i class="fa-solid fa-map-location-dot"></i> ตำแหน่งที่แจ้งเหตุ</h3><div class="report-map citizen-detail-map" id="citizenDetailMap" aria-label="แผนที่ตำแหน่งแจ้งเหตุ"></div>';
    photoHost.after(mapSection);
  }

  if (!document.getElementById('citizenDetailLightbox')) {
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.id = 'citizenDetailLightbox';
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'ดูรูปแจ้งเหตุแบบเต็มจอ');
    lightbox.innerHTML = `
      <button class="lightbox-close" id="citizenLightboxClose" type="button" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button>
      <button class="lightbox-arrow prev" id="citizenLightboxPrev" type="button" aria-label="รูปก่อนหน้า"><i class="fa-solid fa-chevron-left"></i></button>
      <img id="citizenLightboxImage" alt="รูปแจ้งเหตุแบบเต็มจอ">
      <button class="lightbox-arrow next" id="citizenLightboxNext" type="button" aria-label="รูปถัดไป"><i class="fa-solid fa-chevron-right"></i></button>
      <span class="lightbox-counter" id="citizenLightboxCounter">1/1</span>`;
    document.body.appendChild(lightbox);
    document.getElementById('citizenLightboxClose').addEventListener('click', closeCitizenLightbox);
    document.getElementById('citizenLightboxPrev').addEventListener('click', () => changeCitizenLightbox(-1));
    document.getElementById('citizenLightboxNext').addEventListener('click', () => changeCitizenLightbox(1));
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeCitizenLightbox();
    });
    bindCitizenSwipe(document.getElementById('citizenLightboxImage'), () => changeCitizenLightbox(1), () => changeCitizenLightbox(-1));
  }
}

function bindCitizenSwipe(element, onSwipeLeft, onSwipeRight) {
  if (!element) return;
  let startX = 0;
  let startY = 0;
  element.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });
  element.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < 0) onSwipeLeft();
    else onSwipeRight();
  }, { passive: true });
}

function renderCitizenGallery() {
  const host = document.getElementById('citizenDetailPhotos');
  if (!host) return;
  host.replaceChildren();
  if (!citizenGalleryPhotos.length) {
    host.innerHTML = '<div class="empty-state citizen-photo-empty">ไม่มีรูปแนบ</div>';
    return;
  }

  const stage = document.createElement('div');
  stage.className = 'citizen-gallery-stage';
  const openButton = document.createElement('button');
  openButton.className = 'citizen-gallery-open';
  openButton.type = 'button';
  openButton.setAttribute('aria-label', `เปิดรูปที่ ${citizenGalleryIndex + 1} แบบเต็มจอ`);
  const image = document.createElement('img');
  image.src = citizenGalleryPhotos[citizenGalleryIndex];
  image.alt = `รูปแจ้งเหตุ ${citizenGalleryIndex + 1}`;
  openButton.appendChild(image);
  openButton.addEventListener('click', () => openCitizenLightbox(citizenGalleryIndex));
  stage.appendChild(openButton);

  if (citizenGalleryPhotos.length > 1) {
    const previous = document.createElement('button');
    previous.className = 'citizen-gallery-arrow prev';
    previous.type = 'button';
    previous.setAttribute('aria-label', 'รูปก่อนหน้า');
    previous.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    previous.addEventListener('click', () => changeCitizenGallery(-1));
    const next = document.createElement('button');
    next.className = 'citizen-gallery-arrow next';
    next.type = 'button';
    next.setAttribute('aria-label', 'รูปถัดไป');
    next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    next.addEventListener('click', () => changeCitizenGallery(1));
    stage.append(previous, next);
  }

  const counter = document.createElement('span');
  counter.className = 'citizen-gallery-counter';
  counter.textContent = `${citizenGalleryIndex + 1}/${citizenGalleryPhotos.length}`;
  stage.appendChild(counter);
  host.appendChild(stage);
  bindCitizenSwipe(stage, () => changeCitizenGallery(1), () => changeCitizenGallery(-1));

  if (citizenGalleryPhotos.length > 1) {
    const thumbnails = document.createElement('div');
    thumbnails.className = 'citizen-gallery-thumbnails';
    citizenGalleryPhotos.forEach((source, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === citizenGalleryIndex ? 'active' : '';
      button.setAttribute('aria-label', `ดูรูปที่ ${index + 1}`);
      const thumb = document.createElement('img');
      thumb.src = source;
      thumb.alt = `ภาพย่อ ${index + 1}`;
      button.appendChild(thumb);
      button.addEventListener('click', () => {
        citizenGalleryIndex = index;
        renderCitizenGallery();
      });
      thumbnails.appendChild(button);
    });
    host.appendChild(thumbnails);
  }
}

function changeCitizenGallery(step) {
  if (citizenGalleryPhotos.length < 2) return;
  citizenGalleryIndex = (citizenGalleryIndex + step + citizenGalleryPhotos.length) % citizenGalleryPhotos.length;
  renderCitizenGallery();
}

function renderCitizenLightbox() {
  const image = document.getElementById('citizenLightboxImage');
  const counter = document.getElementById('citizenLightboxCounter');
  const previous = document.getElementById('citizenLightboxPrev');
  const next = document.getElementById('citizenLightboxNext');
  if (!image || !citizenGalleryPhotos.length) return;
  image.src = citizenGalleryPhotos[citizenLightboxIndex];
  if (counter) counter.textContent = `${citizenLightboxIndex + 1}/${citizenGalleryPhotos.length}`;
  const showArrows = citizenGalleryPhotos.length > 1;
  if (previous) previous.hidden = !showArrows;
  if (next) next.hidden = !showArrows;
}

function openCitizenLightbox(index) {
  if (!citizenGalleryPhotos.length) return;
  citizenLightboxIndex = Math.max(0, Math.min(index, citizenGalleryPhotos.length - 1));
  renderCitizenLightbox();
  const lightbox = document.getElementById('citizenDetailLightbox');
  lightbox.classList.add('visible');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('citizen-lightbox-open');
  document.getElementById('citizenLightboxClose')?.focus();
}

function closeCitizenLightbox() {
  const lightbox = document.getElementById('citizenDetailLightbox');
  lightbox?.classList.remove('visible');
  lightbox?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('citizen-lightbox-open');
}

function changeCitizenLightbox(step) {
  if (citizenGalleryPhotos.length < 2) return;
  citizenLightboxIndex = (citizenLightboxIndex + step + citizenGalleryPhotos.length) % citizenGalleryPhotos.length;
  renderCitizenLightbox();
}

function renderCitizenDetailMap(latValue, lngValue, title) {
  const section = document.getElementById('citizenDetailMapSection');
  const element = document.getElementById('citizenDetailMap');
  const hasCoordinateValues = latValue !== null && latValue !== undefined && latValue !== ''
    && lngValue !== null && lngValue !== undefined && lngValue !== '';
  const lat = hasCoordinateValues ? Number(latValue) : Number.NaN;
  const lng = hasCoordinateValues ? Number(lngValue) : Number.NaN;
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  if (!section || !element) return;
  section.hidden = !hasCoordinates;
  if (citizenDetailMap) {
    citizenDetailMap.remove();
    citizenDetailMap = null;
  }
  if (!hasCoordinates || typeof window.L === 'undefined') return;
  citizenDetailMap = window.L.map(element, { scrollWheelZoom: true }).setView([lat, lng], 16);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(citizenDetailMap);
  const popup = document.createElement('strong');
  popup.textContent = title || 'ตำแหน่งแจ้งเหตุ';
  window.L.marker([lat, lng]).addTo(citizenDetailMap).bindPopup(popup).openPopup();
  window.setTimeout(() => citizenDetailMap?.invalidateSize(), 100);
}

function populateCitizenDetail({ title, type, description, zone, lat, lng, timestamp, reporter, photos }) {
  const hasCoordinateValues = lat !== null && lat !== undefined && lat !== ''
    && lng !== null && lng !== undefined && lng !== '';
  const numericLat = hasCoordinateValues ? Number(lat) : Number.NaN;
  const numericLng = hasCoordinateValues ? Number(lng) : Number.NaN;
  const hasCoordinates = Number.isFinite(numericLat) && Number.isFinite(numericLng);
  document.getElementById('citizenDetailTitle').textContent = title || '-';
  document.getElementById('citizenDetailType').textContent = type || '-';
  document.getElementById('citizenDetailDescription').textContent = description || '-';
  document.getElementById('citizenDetailZone').textContent = zone || '-';
  document.getElementById('citizenDetailGps').textContent = hasCoordinates ? `${numericLat.toFixed(6)}, ${numericLng.toFixed(6)}` : '-';
  document.getElementById('citizenDetailTime').textContent = formatCitizenReportDateTime(timestamp);
  document.getElementById('citizenDetailReporter').textContent = reporter || 'ไม่ระบุ';
  citizenGalleryPhotos = photos;
  citizenGalleryIndex = 0;
  ensureCitizenDetailUi();
  renderCitizenGallery();
  showCitizenDetailModal();
  renderCitizenDetailMap(numericLat, numericLng, title);
}

function openCitizenFeedbackDetail(feedback) {
  const type = window.FeedbackModule.PROBLEM_TYPES[feedback.problemType] || { label: feedback.problemType };
  populateCitizenDetail({
    title: type.label,
    type: type.label,
    description: feedback.description,
    zone: feedback.zoneName || 'ไม่ระบุ',
    lat: feedback.lat,
    lng: feedback.lng,
    timestamp: feedback.createdAt,
    reporter: feedback.contractorName || 'ประชาชน',
    photos: citizenImagesOf(feedback),
  });
}

function openCitizenReportDetail(report) {
  populateCitizenDetail({
    title: report.title,
    type: report.type === 'Other' ? 'แจ้งเหตุ' : report.type,
    description: report.description,
    zone: '-',
    lat: report.lat,
    lng: report.lng,
    timestamp: report.timestamp,
    reporter: report.reporter || 'ประชาชน',
    photos: citizenImagesOf(report),
  });
}

function showCitizenDetailModal() {
  const modal = document.getElementById('citizenDetailModal');
  modal?.classList.add('visible');
  modal?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('citizen-detail-open');
}

function closeCitizenDetailModal() {
  const modal = document.getElementById('citizenDetailModal');
  modal?.classList.remove('visible');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('citizen-detail-open');
  closeCitizenLightbox();
}

document.getElementById('closeCitizenDetail')?.addEventListener('click', closeCitizenDetailModal);
document.getElementById('citizenDetailModal')?.addEventListener('click', (event) => {
  if (event.target.id === 'citizenDetailModal') closeCitizenDetailModal();
});
document.addEventListener('keydown', (event) => {
  const lightboxOpen = document.getElementById('citizenDetailLightbox')?.classList.contains('visible');
  if (lightboxOpen && event.key === 'ArrowLeft') changeCitizenLightbox(-1);
  if (lightboxOpen && event.key === 'ArrowRight') changeCitizenLightbox(1);
  if (event.key === 'Escape') {
    if (lightboxOpen) closeCitizenLightbox();
    else if (document.getElementById('citizenDetailModal')?.classList.contains('visible')) closeCitizenDetailModal();
  }
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
