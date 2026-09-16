import { analyzePerformanceSample } from './performance-diagnostics';

type MutablePerformanceDetail = {
  loopHz?: number;
  fps?: number;
  rafHz?: number;
  renderMs?: number;
  rafFrameMs?: number;
  gpuMs?: number | null;
  loopRafRatio?: number;
  schedulerGapHz?: number;
  frameBudgetMs?: number;
  cpuBudgetRatio?: number;
  gpuBudgetRatio?: number | null;
  diagnosticHint?: string;
};

function enrichPerformanceEvent(event: Event): void {
  const detail = (event as CustomEvent<MutablePerformanceDetail>).detail;
  if (!detail || typeof detail !== 'object') return;
  Object.assign(detail, analyzePerformanceSample({
    loopHz: detail.loopHz ?? detail.fps,
    rafHz: detail.rafHz,
    renderMs: detail.renderMs,
    rafFrameMs: detail.rafFrameMs,
    gpuMs: detail.gpuMs,
  }));
}

// Run in the capture phase so every existing consumer (Dev UI, TXT capture and tests) receives
// the same derived values without coupling the Three renderer to diagnostic policy.
window.addEventListener('mahjong-live:fps', enrichPerformanceEvent, { capture: true });
