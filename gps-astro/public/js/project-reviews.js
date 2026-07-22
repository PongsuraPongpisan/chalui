(() => {
  const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short",
    }).format(date);
  };

  const stars = (rating) => `${"★".repeat(Math.max(0, Math.min(5, rating)))}${"☆".repeat(Math.max(0, 5 - rating))}`;

  function updateExternalSummaries(projectId, averageRating, reviewCount) {
    document.querySelectorAll("[data-project-rating-summary]").forEach((host) => {
      if (String(host.dataset.projectRatingSummary || "") !== String(projectId)) return;
      host.textContent = reviewCount ? `${Number(averageRating).toFixed(1)} ★ (${reviewCount} รีวิว)` : "ยังไม่มีรีวิว";
      host.classList.toggle("has-reviews", reviewCount > 0);
    });
  }

  function renderReview(review) {
    const article = document.createElement("article");
    article.className = "project-review-item";
    const header = document.createElement("header");
    const avatar = document.createElement("span");
    avatar.className = "project-review-avatar";
    avatar.textContent = "ป";
    const identity = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = review.author || "ประชาชน";
    const meta = document.createElement("span");
    meta.textContent = formatDate(review.updatedAt || review.createdAt);
    identity.append(name, meta);
    const score = document.createElement("span");
    score.className = "project-review-stars";
    score.setAttribute("aria-label", `${review.rating} จาก 5 ดาว`);
    score.textContent = stars(review.rating);
    header.append(avatar, identity, score);
    const comment = document.createElement("p");
    comment.textContent = review.comment;
    article.append(header, comment);
    return article;
  }

  function render(container, payload) {
    const average = container.querySelector("[data-review-average]");
    const count = container.querySelector("[data-review-count]");
    const list = container.querySelector("[data-review-list]");
    const reviewCount = Number(payload.reviewCount) || 0;
    const averageRating = Number(payload.averageRating) || 0;
    if (average) average.textContent = reviewCount ? `${averageRating.toFixed(1)} ★` : "- ★";
    if (count) count.textContent = reviewCount ? `${reviewCount} รีวิว` : "ยังไม่มีรีวิว";
    updateExternalSummaries(container.dataset.projectId, averageRating, reviewCount);
    if (list) {
      list.replaceChildren();
      if (reviewCount) payload.reviews.forEach((review) => list.appendChild(renderReview(review)));
      else {
        const empty = document.createElement("div");
        empty.className = "project-review-empty";
        empty.textContent = "ยังไม่มีความคิดเห็น เป็นคนแรกที่รีวิวโครงการนี้";
        list.appendChild(empty);
      }
    }
    const form = container.querySelector("[data-review-form]");
    if (form && payload.myReview) {
      const rating = form.querySelector(`input[name="rating"][value="${payload.myReview.rating}"]`);
      if (rating) rating.checked = true;
      const comment = form.elements.comment;
      if (comment) comment.value = payload.myReview.comment || "";
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.innerHTML = '<i class="fa-solid fa-pen"></i> อัปเดตรีวิว';
    }
  }

  async function load(container, projectId = container?.dataset.projectId) {
    if (!container || !projectId) return;
    container.dataset.projectId = String(projectId);
    const requestId = String(Date.now() + Math.random());
    container.dataset.reviewRequest = requestId;
    const response = await fetch(`/api/project-reviews?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (container.dataset.reviewRequest !== requestId) return;
    if (!response.ok) throw new Error(payload.error || "ไม่สามารถโหลดรีวิวได้");
    render(container, payload);
  }

  function bind(container) {
    if (!container || container.dataset.reviewBound === "true") return;
    container.dataset.reviewBound = "true";
    const form = container.querySelector("[data-review-form]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector("[data-review-form-status]");
      const button = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const projectId = container.dataset.projectId;
      if (!projectId) return;
      button.disabled = true;
      if (status) {
        status.textContent = "กำลังส่งรีวิว...";
        status.className = "project-review-form-status";
      }
      try {
        const response = await fetch("/api/project-reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, rating: Number(formData.get("rating")), comment: String(formData.get("comment") || "") }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "ส่งรีวิวไม่สำเร็จ");
        render(container, payload);
        if (status) {
          status.textContent = "บันทึกรีวิวเรียบร้อยแล้ว ขอบคุณสำหรับความคิดเห็น";
          status.className = "project-review-form-status success";
        }
      } catch (error) {
        if (status) {
          status.textContent = error.message || "ส่งรีวิวไม่สำเร็จ";
          status.className = "project-review-form-status error";
        }
      } finally {
        button.disabled = false;
      }
    });
  }

  function initialize() {
    document.querySelectorAll("[data-project-reviews]").forEach((container) => {
      bind(container);
      if (container.dataset.projectId) {
        load(container).catch((error) => {
          const list = container.querySelector("[data-review-list]");
          if (list) {
            const message = document.createElement("div");
            message.className = "project-review-empty error";
            message.textContent = error.message || "ไม่สามารถโหลดรีวิวได้";
            list.replaceChildren(message);
          }
        });
      }
    });
  }

  window.ProjectReviews = { load, bind };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
