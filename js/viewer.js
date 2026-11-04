// Full-screen jersey viewer: drag or swipe to spin the jersey between front and back.
function openJerseyViewer(productId) {
  const p = PRODUCTS.find(product => product.id === productId);
  if (!p || !p.image) return;
  const back = p.backImage || p.image;

  const overlay = document.createElement('div');
  overlay.className = 'jv-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${p.club} ${p.kit}`);
  overlay.innerHTML = `
    <button type="button" class="jv-close" aria-label="Close">&times;</button>
    <div class="jv-title">${escapeHtml(p.club)} · ${escapeHtml(p.kit)}</div>
    <div class="jv-stage">
      <div class="jv-card">
        <img class="jv-face jv-front" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.club)} front" draggable="false">
        <img class="jv-face jv-back" src="${escapeHtml(back)}" alt="${escapeHtml(p.club)} back" draggable="false">
      </div>
    </div>
    <div class="jv-hint">Drag to rotate · tap Front / Back</div>
    <div class="jv-actions">
      <button type="button" data-jv="front">Front</button>
      <button type="button" data-jv="back">Back</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('jv-open');

  const card = overlay.querySelector('.jv-card');
  const stage = overlay.querySelector('.jv-stage');
  let angle = 0;
  let startX = 0;
  let startAngle = 0;
  let dragging = false;

  const apply = (animate) => {
    card.style.transition = animate ? 'transform 0.5s ease' : 'none';
    card.style.transform = `rotateY(${angle}deg)`;
  };
  const snapTo = (deg) => { angle = deg; apply(true); };
  const close = () => {
    overlay.remove();
    document.body.classList.remove('jv-open');
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') snapTo(angle - 180);
    if (e.key === 'ArrowRight') snapTo(angle + 180);
  };
  document.addEventListener('keydown', onKey);

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startAngle = angle;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    angle = startAngle + (e.clientX - startX) * 0.6;
    apply(false);
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    snapTo(Math.round(angle / 180) * 180);
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  overlay.querySelector('.jv-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-jv="front"]').addEventListener('click', () => snapTo(Math.round(angle / 360) * 360));
  overlay.querySelector('[data-jv="back"]').addEventListener('click', () => snapTo(Math.round((angle - 180) / 360) * 360 + 180));
}
