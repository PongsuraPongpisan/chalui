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
      if (!lightbox?.classList.contains('visible')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') changeLightbox(-1);
      if (event.key === 'ArrowRight') changeLightbox(1);
    });

    addSwipe(byId('adminReportCover'), () => changeCover(1), () => changeCover(-1));
    addSwipe(byId('adminReportLightbox'), () => changeLightbox(1), () => changeLightbox(-1));
    initializeMap();
  }

  if (document.readyState === 'complete') initialize();
  else window.addEventListener('load', initialize, { once: true });
})();
