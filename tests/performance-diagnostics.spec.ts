import { expect, test } from '@playwright/test';
import { analyzePerformanceSample } from '../client/src/performance-diagnostics';

test('quantifies an animation-loop gap independently from browser RAF headroom', () => {
  const result = analyzePerformanceSample({
    loopHz: 32,
    rafHz: 120,
    renderMs: 0.60,
    rafFrameMs: 8.33,
    gpuMs: null,
  });

  expect(result.loopRafRatio).toBeCloseTo(32 / 120, 4);
  expect(result.schedulerGapHz).toBeCloseTo(88, 3);
  expect(result.frameBudgetMs).toBeCloseTo(8.33, 2);
  expect(result.cpuBudgetRatio).toBeCloseTo(0.60 / 8.33, 3);
  expect(result.diagnosticHint).toBe('animation-loop-gap');
});

test('does not report a scheduler gap when the Three loop tracks browser RAF', () => {
  const result = analyzePerformanceSample({
    loopHz: 118,
    rafHz: 120,
    renderMs: 1.20,
    rafFrameMs: 8.33,
    gpuMs: 2.10,
  });

  expect(result.loopRafRatio).toBeGreaterThan(0.95);
  expect(result.schedulerGapHz).toBeCloseTo(2, 3);
  expect(result.gpuBudgetRatio).toBeCloseTo(2.10 / 8.33, 3);
  expect(result.diagnosticHint).toBe('headroom');
});

test('distinguishes a browser RAF limit from an animation-loop limit', () => {
  const result = analyzePerformanceSample({
    loopHz: 31,
    rafHz: 32,
    renderMs: 0.55,
    rafFrameMs: 31.25,
    gpuMs: null,
  });

  expect(result.loopRafRatio).toBeGreaterThan(0.95);
  expect(result.diagnosticHint).toBe('browser-raf-limit');
});
