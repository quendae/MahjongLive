const DEV_TUNING_EVENT = 'mahjong-live:dev-tuning';

// table-3d deliberately caches the last tuning object by identity so normal game DOM
// reconciles do not dirty materials, shadows and projection state again. The Dev panel,
// however, mutates one long-lived settings object while a range input is dragged. That made
// the first tiny slider movement visible and every following movement look unchanged.
// Forward a fresh top-level revision in a microtask. The renderer still keeps its identity
// fast-path, but every genuine Dev input now has a distinct revision to apply.
const forwardedDetails = new WeakSet<object>();
let pendingDetail: Record<string, unknown> | null = null;
let forwardingScheduled = false;
let cleanupScheduled = false;

function clearLegacyAppearanceInlineStyles(): void {
  // Appearance is now owned by appearance.ts + CSS variables. Older Dev preview code still
  // paints table/back colours as inline styles, which has higher priority than the live user
  // Options variables. Clear only those legacy appearance properties; geometry/UI Dev vars stay.
  document.querySelectorAll<HTMLElement>('.mahjong-table').forEach((table) => {
    table.style.removeProperty('background');
    table.style.removeProperty('background-color');
    table.style.removeProperty('background-image');
    table.style.removeProperty('background-size');
    table.style.removeProperty('background-position');
    table.style.removeProperty('background-repeat');
  });
  document.querySelectorAll<HTMLElement>('.tile-back').forEach((tile) => {
    tile.style.removeProperty('background');
    tile.style.removeProperty('background-color');
    tile.style.removeProperty('background-image');
    tile.style.removeProperty('background-size');
    tile.style.removeProperty('background-position');
    tile.style.removeProperty('background-repeat');
  });
}

function scheduleLegacyCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  requestAnimationFrame(() => {
    cleanupScheduled = false;
    clearLegacyAppearanceInlineStyles();
  });
}

window.addEventListener(DEV_TUNING_EVENT, (event) => {
  // Dev applies its old inline appearance preview immediately before broadcasting. Remove it in
  // the same task, then do one frame-late cleanup as a guard against MutationObserver ordering.
  clearLegacyAppearanceInlineStyles();
  scheduleLegacyCleanup();
  const detail = (event as CustomEvent<Record<string, unknown> | null>).detail;
  if (!detail || typeof detail !== 'object' || forwardedDetails.has(detail)) return;

  // Coalesce multiple writes in the same task. A shallow copy is enough: table-3d compares
  // the top-level object identity, while nested values are read synchronously during reconcile.
  pendingDetail = { ...detail };
  if (forwardingScheduled) return;
  forwardingScheduled = true;
  queueMicrotask(() => {
    forwardingScheduled = false;
    const next = pendingDetail;
    pendingDetail = null;
    if (!next) return;
    forwardedDetails.add(next);
    window.dispatchEvent(new CustomEvent(DEV_TUNING_EVENT, { detail: next }));
  });
});

// Dev observes the whole body (including its own panel and the Options dialog) and may reapply its
// legacy inline preview after any child-list update. Register after it and clean those properties
// one frame later; attribute/style writes themselves are not observed, so this cannot loop.
const observer = new MutationObserver(scheduleLegacyCleanup);
observer.observe(document.body, { childList: true, subtree: true });

scheduleLegacyCleanup();
