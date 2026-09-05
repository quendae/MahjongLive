import './visual-polish.css';

// The 3D renderer intentionally freezes its expensive shadow map while the table is static.
// Hover lift animates a child visual rather than the authoritative actor transform, so without a
// short refresh burst the shadow can remain baked at the tile's resting position. Reuse the cheap
// renderer-side benchmark visibility event only to dirty the shadow map for a handful of frames.
// Do not interfere with an explicit Dev benchmark sweep.
let shadowFrames = 0;
let shadowRaf = 0;

function benchmarkSweepActive(): boolean {
  const status = document.querySelector<HTMLElement>('.dev-tuning-status')?.textContent?.trim() ?? '';
  return status.startsWith('Benchmark ');
}

function shadowTick(): void {
  shadowRaf = 0;
  if (shadowFrames <= 0) return;
  shadowFrames -= 1;

  const table = document.querySelector<HTMLElement>('.mahjong-table.table-3d-active');
  if (table && !benchmarkSweepActive()) {
    window.dispatchEvent(new CustomEvent('mahjong-live:benchmark-stage', { detail: { stage: 'normal' } }));
  }

  if (shadowFrames > 0) shadowRaf = requestAnimationFrame(shadowTick);
}

function refreshHoverShadow(frames = 24): void {
  if (!document.querySelector('.mahjong-table.table-3d-active')) return;
  shadowFrames = Math.max(shadowFrames, frames);
  if (!shadowRaf) shadowRaf = requestAnimationFrame(shadowTick);
}

// table-3d registered its capture handlers earlier in the document, so by the time these listeners
// run the hover class already reflects the current raycast result. Pointer down/up also changes the
// lift height and therefore needs a short shadow refresh.
window.addEventListener('pointermove', () => refreshHoverShadow(20), { passive: true, capture: true });
window.addEventListener('pointerdown', () => refreshHoverShadow(16), { passive: true, capture: true });
window.addEventListener('pointerup', () => refreshHoverShadow(22), { passive: true, capture: true });
window.addEventListener('blur', () => refreshHoverShadow(18));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshHoverShadow(18);
});
