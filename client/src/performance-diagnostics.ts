export type PerformanceDiagnosticHint =
  | 'animation-loop-gap'
  | 'browser-raf-limit'
  | 'gpu-bound'
  | 'cpu-submit-bound'
  | 'headroom';

export type PerformanceDiagnosticInput = {
  loopHz?: number;
  rafHz?: number;
  renderMs?: number;
  rafFrameMs?: number;
  gpuMs?: number | null;
};

export type PerformanceDiagnostic = {
  loopRafRatio: number;
  schedulerGapHz: number;
  frameBudgetMs: number;
  cpuBudgetRatio: number;
  gpuBudgetRatio: number | null;
  diagnosticHint: PerformanceDiagnosticHint;
};

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function analyzePerformanceSample(input: PerformanceDiagnosticInput): PerformanceDiagnostic {
  const loopHz = finite(input.loopHz);
  const rafHz = finite(input.rafHz);
  const renderMs = finite(input.renderMs);
  const reportedRafFrameMs = finite(input.rafFrameMs);
  const frameBudgetMs = reportedRafFrameMs > 0
    ? reportedRafFrameMs
    : rafHz > 0 ? 1000 / rafHz : 0;
  const loopRafRatio = rafHz > 0 ? loopHz / rafHz : 0;
  const schedulerGapHz = Math.max(0, rafHz - loopHz);
  const cpuBudgetRatio = frameBudgetMs > 0 ? renderMs / frameBudgetMs : 0;
  const gpuMs = input.gpuMs === null || input.gpuMs === undefined ? null : finite(input.gpuMs);
  const gpuBudgetRatio = gpuMs === null || frameBudgetMs <= 0 ? null : gpuMs / frameBudgetMs;

  let diagnosticHint: PerformanceDiagnosticHint = 'headroom';
  const lowRenderCost = cpuBudgetRatio < 0.60 && (gpuBudgetRatio === null || gpuBudgetRatio < 0.60);
  if (rafHz > 0 && loopHz > 0 && loopRafRatio < 0.75 && lowRenderCost) {
    diagnosticHint = 'animation-loop-gap';
  } else if (rafHz > 0 && rafHz < 45 && loopRafRatio >= 0.75) {
    diagnosticHint = 'browser-raf-limit';
  } else if (gpuBudgetRatio !== null && gpuBudgetRatio >= 0.80) {
    diagnosticHint = 'gpu-bound';
  } else if (cpuBudgetRatio >= 0.80) {
    diagnosticHint = 'cpu-submit-bound';
  }

  return {
    loopRafRatio,
    schedulerGapHz,
    frameBudgetMs,
    cpuBudgetRatio,
    gpuBudgetRatio,
    diagnosticHint,
  };
}
