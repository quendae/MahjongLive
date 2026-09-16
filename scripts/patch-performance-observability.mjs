import { readFile, writeFile } from 'node:fs/promises';

const tablePath = 'client/src/table-3d.ts';
const devPath = 'client/src/dev-tuning.ts';
let table = await readFile(tablePath, 'utf8');
let dev = await readFile(devPath, 'utf8');

function replaceExact(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

if (!table.includes('syncActorsMs: number;')) {
  table = replaceExact(
    table,
    `  textureAnisotropy: number;\n  shadowRefreshSerial: number;\n};`,
    `  textureAnisotropy: number;\n  shadowRefreshSerial: number;\n  syncActorsMs: number;\n  reconcileMs: number;\n  staticBatchMs: number;\n};`,
    'TableRuntime performance fields',
  );
}

if (!table.includes('syncActorsMs: 0,')) {
  table = replaceExact(
    table,
    `    textureAnisotropy: Math.min(tuning.graphics.anisotropy, renderer.capabilities?.getMaxAnisotropy?.() ?? 1),\n    shadowRefreshSerial: 0,\n  };`,
    `    textureAnisotropy: Math.min(tuning.graphics.anisotropy, renderer.capabilities?.getMaxAnisotropy?.() ?? 1),\n    shadowRefreshSerial: 0,\n    syncActorsMs: 0,\n    reconcileMs: 0,\n    staticBatchMs: 0,\n  };`,
    'TableRuntime performance initialization',
  );
}

if (!table.includes('const syncActorsStarted = performance.now();')) {
  table = replaceExact(
    table,
    `function syncActors(rt: TableRuntime, table: HTMLElement): void {\n  syncFaceMode(rt);`,
    `function syncActors(rt: TableRuntime, table: HTMLElement): void {\n  const syncActorsStarted = performance.now();\n  syncFaceMode(rt);`,
    'syncActors timer start',
  );
  table = replaceExact(
    table,
    `  rt.initialized = true;\n  applyBenchmarkVisibility(rt);\n}\n\nfunction syncStaticRiverInstances`,
    `  rt.initialized = true;\n  applyBenchmarkVisibility(rt);\n  rt.syncActorsMs = performance.now() - syncActorsStarted;\n}\n\nfunction syncStaticRiverInstances`,
    'syncActors timer end',
  );
}

if (!table.includes('const staticBatchStarted = performance.now();')) {
  table = replaceExact(
    table,
    `function syncStaticRiverInstances(rt: TableRuntime): void {\n  if (!rt.staticRiverDirty) return;\n  rt.staticRiverDirty = false;`,
    `function syncStaticRiverInstances(rt: TableRuntime): void {\n  if (!rt.staticRiverDirty) return;\n  const staticBatchStarted = performance.now();\n  rt.staticRiverDirty = false;`,
    'static batching timer start',
  );
  table = replaceExact(
    table,
    `  rebuildMergedStaticFaceBatch(rt, mergedFaces);\n  applyBenchmarkVisibility(rt);\n  if (rt.renderer.shadowMap?.enabled) rt.renderer.shadowMap.needsUpdate = true;\n}\n\nconst STRESS_TILE_LABELS`,
    `  rebuildMergedStaticFaceBatch(rt, mergedFaces);\n  applyBenchmarkVisibility(rt);\n  if (rt.renderer.shadowMap?.enabled) rt.renderer.shadowMap.needsUpdate = true;\n  rt.staticBatchMs = performance.now() - staticBatchStarted;\n}\n\nconst STRESS_TILE_LABELS`,
    'static batching timer end',
  );
}

if (!table.includes('const reconcileStarted = performance.now();')) {
  table = replaceExact(
    table,
    `async function reconcile(): Promise<void> {\n  reconcileScheduled = false;`,
    `async function reconcile(): Promise<void> {\n  const reconcileStarted = performance.now();\n  reconcileScheduled = false;`,
    'reconcile timer start',
  );
  table = replaceExact(
    table,
    `  syncActors(rt, table);\n  updateModeButton();\n}\n\nfunction scheduleReconcile`,
    `  syncActors(rt, table);\n  updateModeButton();\n  rt.reconcileMs = performance.now() - reconcileStarted;\n}\n\nfunction scheduleReconcile`,
    'reconcile timer end',
  );
}

if (!table.includes('syncActorsMs: rt.syncActorsMs,')) {
  table = replaceExact(
    table,
    `        pixelRatio: rt.renderer.getPixelRatio(),\n        visibility: document.visibilityState,\n      } }));`,
    `        pixelRatio: rt.renderer.getPixelRatio(),\n        visibility: document.visibilityState,\n        syncActorsMs: rt.syncActorsMs,\n        reconcileMs: rt.reconcileMs,\n        staticBatchMs: rt.staticBatchMs,\n        shadowRefreshSerial: rt.shadowRefreshSerial,\n      } }));`,
    'performance event observability fields',
  );
}

if (!dev.includes('diagnosticHint?: string;')) {
  dev = replaceExact(
    dev,
    `  geometryQuality?: number;\n};`,
    `  geometryQuality?: number;\n  loopRafRatio?: number;\n  schedulerGapHz?: number;\n  frameBudgetMs?: number;\n  cpuBudgetRatio?: number;\n  gpuBudgetRatio?: number | null;\n  diagnosticHint?: string;\n  syncActorsMs?: number;\n  reconcileMs?: number;\n  staticBatchMs?: number;\n  shadowRefreshSerial?: number;\n};`,
    'PerformanceDetail diagnostics',
  );
}

if (!dev.includes('performanceNumber(detail.loopRafRatio, 3),')) {
  dev = replaceExact(
    dev,
    `    String(detail.geometryQuality ?? ''),\n    performanceNumber(detail.pixelRatio),\n  ].join('\\t'));`,
    `    String(detail.geometryQuality ?? ''),\n    performanceNumber(detail.pixelRatio),\n    performanceNumber(detail.loopRafRatio, 3),\n    performanceNumber(detail.schedulerGapHz, 2),\n    performanceNumber(detail.frameBudgetMs, 3),\n    performanceNumber(detail.cpuBudgetRatio, 3),\n    performanceNumber(detail.gpuBudgetRatio, 3),\n    detail.diagnosticHint ?? '',\n    performanceNumber(detail.syncActorsMs, 3),\n    performanceNumber(detail.reconcileMs, 3),\n    performanceNumber(detail.staticBatchMs, 3),\n    String(detail.shadowRefreshSerial ?? ''),\n  ].join('\\t'));`,
    'performance capture row diagnostics',
  );
  dev = replaceExact(
    dev,
    `'elapsed_s\\tiso_time\\tvisibility\\tthree_loop_hz\\tbrowser_raf_hz\\tthree_frame_ms\\traf_frame_ms\\tcpu_submit_ms\\tgpu_ms\\tgpu_timer_supported\\tdraw_calls\\ttriangles\\ttiles\\tmoving_tiles\\tbatched_static_tiles\\tbatched_face_tiles\\tface_batches\\trenderer_backend\\tbenchmark_stage\\tgeometry_quality\\tpixel_ratio',`,
    `'elapsed_s\\tiso_time\\tvisibility\\tthree_loop_hz\\tbrowser_raf_hz\\tthree_frame_ms\\traf_frame_ms\\tcpu_submit_ms\\tgpu_ms\\tgpu_timer_supported\\tdraw_calls\\ttriangles\\ttiles\\tmoving_tiles\\tbatched_static_tiles\\tbatched_face_tiles\\tface_batches\\trenderer_backend\\tbenchmark_stage\\tgeometry_quality\\tpixel_ratio\\tloop_raf_ratio\\tscheduler_gap_hz\\tframe_budget_ms\\tcpu_budget_ratio\\tgpu_budget_ratio\\tdiagnostic_hint\\tsync_actors_ms\\treconcile_ms\\tstatic_batch_ms\\tshadow_refresh_serial',`,
    'performance capture header diagnostics',
  );
}

if (!dev.includes('const diagnostic = detail.diagnosticHint ??')) {
  dev = replaceExact(
    dev,
    `  const gpuMs = Number.isFinite(detail.gpuMs) ? \`${'${(detail.gpuMs ?? 0).toFixed(2)}'}ms GPU\` : 'GPU n/a';\n  target.textContent = \`${'${detail.rendererBackend ?? \'renderer\'}'} · ${'${detail.benchmarkStage ?? \'normal\'}'} · Loop ${'${loopHz}'} · RAF ${'${rafHz}'} · ${'${gpuMs}'} · ${'${detail.calls ?? 0}'} calls · ${'${detail.actors ?? 0}'} tiles\`;\n  target.title = \`${'${(detail.frameMs ?? 0).toFixed(2)}'}ms Three frame · ${'${(detail.rafFrameMs ?? 0).toFixed(2)}'}ms RAF frame · ${'${(detail.renderMs ?? 0).toFixed(2)}'}ms CPU submit · ${'${detail.triangles ?? 0}'} triangles · ${'${detail.moving ?? 0}'} moving · ${'${detail.instancedRivers ?? 0}'} batched static · ${'${detail.batchedFaces ?? 0}'} batched faces in ${'${detail.faceBatches ?? 0}'} face draws · ${'${(detail.pixelRatio ?? 1).toFixed(2)}'}× pixel ratio · backend ${'${detail.rendererBackend ?? \'\'}'} · stage ${'${detail.benchmarkStage ?? \'\'}'} · ${'${detail.visibility ?? document.visibilityState}'}\`;`,
    `  const gpuMs = Number.isFinite(detail.gpuMs) ? \`${'${(detail.gpuMs ?? 0).toFixed(2)}'}ms GPU\` : 'GPU n/a';\n  const diagnostic = detail.diagnosticHint ?? 'collecting';\n  const loopRaf = Number.isFinite(detail.loopRafRatio) ? (detail.loopRafRatio ?? 0).toFixed(2) : '—';\n  target.textContent = \`${'${detail.rendererBackend ?? \'renderer\'}'} · ${'${detail.benchmarkStage ?? \'normal\'}'} · Loop ${'${loopHz}'} · RAF ${'${rafHz}'} · Loop/RAF ${'${loopRaf}'} · ${'${diagnostic}'} · ${'${gpuMs}'} · ${'${detail.calls ?? 0}'} calls · ${'${detail.actors ?? 0}'} tiles\`;\n  target.title = \`${'${(detail.frameMs ?? 0).toFixed(2)}'}ms Three frame · ${'${(detail.rafFrameMs ?? 0).toFixed(2)}'}ms RAF frame · ${'${(detail.renderMs ?? 0).toFixed(2)}'}ms CPU submit · ${'${(detail.syncActorsMs ?? 0).toFixed(2)}'}ms syncActors · ${'${(detail.reconcileMs ?? 0).toFixed(2)}'}ms reconcile · ${'${(detail.staticBatchMs ?? 0).toFixed(2)}'}ms static batch · shadow serial ${'${detail.shadowRefreshSerial ?? 0}'} · ${'${detail.triangles ?? 0}'} triangles · ${'${detail.moving ?? 0}'} moving · ${'${detail.instancedRivers ?? 0}'} batched static · ${'${detail.batchedFaces ?? 0}'} batched faces in ${'${detail.faceBatches ?? 0}'} face draws · ${'${(detail.pixelRatio ?? 1).toFixed(2)}'}× pixel ratio · backend ${'${detail.rendererBackend ?? \'\'}'} · stage ${'${detail.benchmarkStage ?? \'\'}'} · ${'${detail.visibility ?? document.visibilityState}'}\`;`,
    'performance live diagnostics',
  );
}

await writeFile(tablePath, table, 'utf8');
await writeFile(devPath, dev, 'utf8');
console.log('Applied performance observability instrumentation.');
