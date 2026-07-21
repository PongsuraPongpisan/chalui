(() => {
  const report = window.ADMIN_REPORT_DATA;
  if (!report) return;

  const byId = (id) => document.getElementById(id);
  const coverPhotos = Array.isArray(report.sitePhotos) ? report.sitePhotos : [];
  let coverIndex = 0;
  let lightboxPhotos = [];
  let lightboxIndex = 0;

  function renderCover() {
    const image = byId('adminReportCoverImg');
    const counter = byId('adminReportCoverCounter');
    if (!image || !coverPhotos.length) return;
    image.src = coverPhotos[coverIndex];
    if (counter) counter.textContent = `${coverIndex + 1}/${coverPhotos.length}`;
    document.querySelectorAll('[data-cover-index] img').forEach((thumb, index) => {
      thumb.classList.toggle('active', index === coverIndex);
    });
  }

  function changeCover(step) {
    if (coverPhotos.length < 2) return;
    coverIndex = (coverIndex + step + coverPhotos.length) % coverPhotos.length;
    renderCover();
  }

  function renderLightbox() {
    const image = byId('adminReportLightboxImg');
    const counter = byId('adminReportLightboxCounter');
    const previous = byId('adminReportLightboxPrev');
    const next = byId('adminReportLightboxNext');
    if (!image || !lightboxPhotos.length) return;
    image.src = lightboxPhotos[lightboxIndex];
    counter.textContent = `${lightboxIndex + 1}/${lightboxPhotos.length}`;
    const showArrows = lightboxPhotos.length > 1;
    if (previous) previous.hidden = !showArrows;
    if (next) next.hidden = !showArrows;
  }

  function openLightbox(photos, index = 0) {
    if (!Array.isArray(photos) || photos.length === 0) return;
    lightboxPhotos = photos;
    lightboxIndex = Math.max(0, Math.min(index, photos.length - 1));
    renderLightbox();
    const lightbox = byId('adminReportLightbox');
    lightbox.classList.add('visible');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    byId('adminReportLightboxClose')?.focus();
  }

  function closeLightbox() {
    const lightbox = byId('adminReportLightbox');
    lightbox?.classList.remove('visible');
    lightbox?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
  }

  function changeLightbox(step) {
    if (lightboxPhotos.length < 2) return;
    lightboxIndex = (lightboxIndex + step + lightboxPhotos.length) % lightboxPhotos.length;
    renderLightbox();
  }

  function addSwipe(element, onSwipeLeft, onSwipeRight) {
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

  function initializeMap() {
    const element = byId('adminReportMap');
    if (!element || typeof window.L === 'undefined' || report.lat === null || report.lng === null) return;
    const map = window.L.map(element, { scrollWheelZoom: true }).setView([report.lat, report.lng], 15);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const popup = document.createElement('strong');
    popup.textContent = report.name;
    window.L.marker([report.lat, report.lng]).addTo(map).bindPopup(popup).openPopup();
    if (Number.isFinite(report.boundaryMeters) && report.boundaryMeters > 0) {
      window.L.circle([report.lat, report.lng], {
        radius: report.boundaryMeters / 2,
        color: '#168c7e', fillColor: '#29b7a5', fillOpacity: 0.12, weight: 2,
      }).addTo(map);
    }
    window.setTimeout(() => map.invalidateSize(), 100);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    })[character]);
  }

  function approvalStatus() {
    return report.adminApprovalStatus === 'approved' ? 'approved' : 'pending';
  }

  function formatDecisionDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function showApprovalError(message) {
    const error = byId('adminApprovalError');
    if (!error) return;
    error.textContent = message || '';
    error.hidden = !message;
  }

  function canDecideProject() {
    return report.projectStatus === 'completed';
  }

  function setApprovalBusy(busy) {
    document.querySelectorAll('#adminApprovalCard button').forEach((button) => { button.disabled = busy; });
    const approve = byId('adminApproveBtn');
    if (approve) {
      approve.disabled = busy || !canDecideProject();
      approve.innerHTML = busy ? '<i class="fa-solid fa-hourglass-half"></i> กำลังบันทึก...' : '<i class="fa-solid fa-circle-check"></i> อนุมัติ';
    }
  }

  let confirmationTimer = null;

  function bindApprovalActions() {
    if (canDecideProject()) {
      byId('adminApproveBtn')?.addEventListener('click', openApprovalConfirmation);
    }
  }

  function renderApprovalPanel() {
    const host = document.querySelector('.report-detail-grid');
    if (!host) return;
    let panel = byId('adminApprovalCard');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'adminApprovalCard';
      panel.className = 'report-section report-detail-card glass-panel admin-approval-card';
      host.appendChild(panel);
    }
    const status = approvalStatus();
    const isCompleted = canDecideProject();
    const meta = {
      pending: {
        icon: 'fa-clock',
        label: 'รอการอนุมัติ',
        note: isCompleted
          ? 'งานเสร็จสิ้นแล้ว กรุณาตรวจสอบรายละเอียดและรูปถ่ายก่อนอนุมัติ'
          : 'งานต้องอยู่ในสถานะเสร็จสิ้นก่อนจึงจะอนุมัติได้',
      },
      approved: { icon: 'fa-circle-check', label: 'อนุมัติแล้ว / Approved', note: 'รายงานนี้ได้รับการอนุมัติจากผู้ดูแลระบบแล้ว' },
    }[status];
    const decisionDetails = status === 'pending' ? '' : `
      <dl class="approval-decision-details">
        <dt>ผู้ตัดสินใจ</dt><dd>${escapeHtml(report.adminDecidedBy || '-')}</dd>
        <dt>เวลาตัดสินใจ</dt><dd>${escapeHtml(formatDecisionDate(report.adminDecidedAt))}</dd>
      </dl>`;
    const completionNotice = status === 'pending' && !isCompleted ? `
      <div class="completion-warning" role="note">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <span>ไม่สามารถอนุมัติได้ เนื่องจากงานยังไม่อยู่ในสถานะเสร็จสิ้น</span>
      </div>` : '';
    const decisionDisabledAttributes = isCompleted
      ? ''
      : ' disabled aria-disabled="true" title="งานต้องมีสถานะเสร็จสิ้นก่อนจึงจะอนุมัติได้"';
    const actions = status === 'pending' ? `
      ${completionNotice}
      <div class="admin-approval-actions">
        <button class="approve-btn approval-action-btn" id="adminApproveBtn" type="button"${decisionDisabledAttributes}><i class="fa-solid fa-circle-check"></i> อนุมัติ</button>
      </div>` : '';
    panel.innerHTML = `
      <div class="admin-approval-heading">
        <h2 class="report-section-title"><i class="fa-solid fa-user-check"></i> การอนุมัติงานก่อสร้าง</h2>
        <span class="approval-status-chip approval-${status}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>
      </div>
      <p class="admin-approval-note">${meta.note}</p>
      ${decisionDetails}
      <div class="reject-modal-error" id="adminApprovalError" hidden></div>
      ${actions}`;
    bindApprovalActions();
  }

  function ensureDecisionModal() {
    let modal = byId('adminRejectModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'adminRejectModal';
    modal.className = 'reject-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'adminDecisionTitle');
    modal.innerHTML = `
      <div class="reject-modal-panel">
        <h3 id="adminDecisionTitle"><i class="fa-solid fa-circle-check"></i> ยืนยันการอนุมัติ</h3>
        <p id="adminDecisionMessage">ต้องการอนุมัติงานก่อสร้างนี้ใช่หรือไม่? เมื่อตัดสินใจแล้วจะไม่สามารถแก้ไขได้</p>
        <div class="reject-modal-error" id="adminRejectError" hidden></div>
        <div class="reject-modal-actions">
          <button class="secondary-action" id="adminRejectCancel" type="button">ยกเลิก</button>
          <button class="approve-btn" id="adminRejectConfirm" type="button" disabled></button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    byId('adminRejectCancel')?.addEventListener('click', closeRejectModal);
    byId('adminRejectConfirm')?.addEventListener('click', confirmApproval);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeRejectModal(); });
    return modal;
  }

  function updateConfirmationButton(secondsRemaining) {
    const button = byId('adminRejectConfirm');
    if (!button) return;
    button.disabled = secondsRemaining > 0;
    button.innerHTML = secondsRemaining > 0
      ? `<i class="fa-solid fa-clock"></i> กดได้ในอีก ${secondsRemaining} วินาที`
      : '<i class="fa-solid fa-circle-check"></i> ยืนยันอนุมัติ';
  }

  function openApprovalConfirmation() {
    if (!canDecideProject()) return;
    const modal = ensureDecisionModal();
    const error = byId('adminRejectError');
    if (error) { error.textContent = ''; error.hidden = true; }
    if (confirmationTimer) window.clearInterval(confirmationTimer);
    let secondsRemaining = 3;
    updateConfirmationButton(secondsRemaining);
    confirmationTimer = window.setInterval(() => {
      secondsRemaining -= 1;
      updateConfirmationButton(secondsRemaining);
      if (secondsRemaining <= 0) {
        window.clearInterval(confirmationTimer);
        confirmationTimer = null;
        byId('adminRejectConfirm')?.focus();
      }
    }, 1000);
    modal.hidden = false;
    document.body.classList.add('approval-modal-open');
    byId('adminRejectCancel')?.focus();
  }

  function closeRejectModal() {
    if (confirmationTimer) window.clearInterval(confirmationTimer);
    confirmationTimer = null;
    const modal = byId('adminRejectModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('approval-modal-open');
  }

  function confirmApproval() {
    const button = byId('adminRejectConfirm');
    if (button?.disabled) return;
    submitApproval();
  }

  function notifyProjectUpdate() {
    try {
      localStorage.setItem('chalui-project-updated', String(Date.now()));
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('chalui-projects');
        channel.postMessage({ type: 'project-updated', id: report.id });
        channel.close();
      }
    } catch (_) { /* polling remains the fallback */ }
  }

  async function submitApproval() {
    showApprovalError('');
    setApprovalBusy(true);
    const modalButton = byId('adminRejectConfirm');
    if (modalButton) modalButton.disabled = true;
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(report.id)}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถบันทึกผลการอนุมัติได้');
      Object.assign(report, result.project || {});
      closeRejectModal();
      notifyProjectUpdate();
      window.location.assign('/admin?section=approved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึกผลการอนุมัติได้';
      if (!byId('adminRejectModal')?.hidden) {
        const modalError = byId('adminRejectError');
        if (modalError) { modalError.textContent = message; modalError.hidden = false; }
      } else showApprovalError(message);
    } finally {
      setApprovalBusy(false);
      if (modalButton && !byId('adminRejectModal')?.hidden) modalButton.disabled = false;
    }
  }

  function initialize() {
    byId('adminReportCoverPrev')?.addEventListener('click', () => changeCover(-1));
    byId('adminReportCoverNext')?.addEventListener('click', () => changeCover(1));
    byId('adminReportCoverImg')?.addEventListener('click', () => openLightbox(coverPhotos, coverIndex));
    document.querySelectorAll('[data-cover-index]').forEach((button) => {
      button.addEventListener('click', () => {
        coverIndex = Number(button.dataset.coverIndex);
        renderCover();
      });
    });

    document.querySelectorAll('[data-checkpoint-album]').forEach((album) => {
      const key = album.dataset.checkpointAlbum;
      const photos = report.checkpointPhotos?.[key] || [];
      album.querySelectorAll('[data-checkpoint-index]').forEach((button) => {
        button.addEventListener('click', () => openLightbox(photos, Number(button.dataset.checkpointIndex)));
      });
    });

    byId('adminReportLightboxClose')?.addEventListener('click', closeLightbox);
    byId('adminReportLightboxPrev')?.addEventListener('click', () => changeLightbox(-1));
    byId('adminReportLightboxNext')?.addEventListener('click', () => changeLightbox(1));
    byId('adminReportLightbox')?.addEventListener('click', (event) => {
      if (event.target.id === 'adminReportLightbox') closeLightbox();
    });
    document.addEventListener('keydown', (event) => {
      const lightbox = byId('adminReportLightbox');
      if (event.key === 'Escape' && !byId('adminRejectModal')?.hidden) closeRejectModal();
      if (!lightbox?.classList.contains('visible')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') changeLightbox(-1);
      if (event.key === 'ArrowRight') changeLightbox(1);
    });

    addSwipe(byId('adminReportCover'), () => changeCover(1), () => changeCover(-1));
    addSwipe(byId('adminReportLightbox'), () => changeLightbox(1), () => changeLightbox(-1));
    renderApprovalPanel();
    initializeMap();
  }

  if (document.readyState === 'complete') initialize();
  else window.addEventListener('load', initialize, { once: true });
})();
