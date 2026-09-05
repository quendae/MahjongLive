import './visual-polish.css';

// The 3D renderer intentionally freezes its expensive shadow map while the table is static.
// Hover lift animates a child visual rather than the authoritative actor transform, so without a
// short refresh burst the shadow can remain baked at the tile's resting position. Reuse the cheap
// renderer-side benchmark visibility event only while a hover lift is entering/leaving/pressed.
let shadowFrames = 0;
let shadowRaf = 0;
let wasHovering = false;

function benchmarkSweepActive(): boolean {
  const status = document.querySelector<HTMLElement>('.dev-tuning-status')?.textContent?.trim() ?? '';
  return status.startsWith('Benchmark ');
}

function active3dTable(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mahjong-table.table-3d-active');
}

function shadowTick(): void {
  shadowRaf = 0;
  if (shadowFrames <= 0) return;
  shadowFrames -= 1;

  if (active3dTable() && !benchmarkSweepActive()) {
    // table-3d's normal-stage handler dirties the cached shadow map without rebuilding the scene.
    window.dispatchEvent(new CustomEvent('mahjong-live:benchmark-stage', { detail: { stage: 'normal' } }));
  }

  if (shadowFrames > 0) shadowRaf = requestAnimationFrame(shadowTick);
}

function refreshHoverShadow(frames = 24): void {
  if (!active3dTable()) return;
  shadowFrames = Math.max(shadowFrames, frames);
  if (!shadowRaf) shadowRaf = requestAnimationFrame(shadowTick);
}

function syncHoverShadow(): void {
  const table = active3dTable();
  const hovering = Boolean(table?.classList.contains('table-3d-tile-hover'));
  // While hovering, keep the map following the visual for the easing interval. When the pointer
  // leaves, issue another burst so the contact shadow settles back under the resting tile.
  if (hovering) refreshHoverShadow(18);
  else if (wasHovering) refreshHoverShadow(22);
  wasHovering = hovering;
}

// table-3d registered its capture handlers earlier, so its hover class is current when this runs.
window.addEventListener('pointermove', syncHoverShadow, { passive: true, capture: true });
window.addEventListener('pointerdown', () => {
  if (wasHovering) refreshHoverShadow(16);
}, { passive: true, capture: true });
window.addEventListener('pointerup', () => {
  if (wasHovering) refreshHoverShadow(20);
}, { passive: true, capture: true });
window.addEventListener('blur', () => {
  if (wasHovering) refreshHoverShadow(22);
  wasHovering = false;
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    wasHovering = false;
    refreshHoverShadow(18);
  }
});
