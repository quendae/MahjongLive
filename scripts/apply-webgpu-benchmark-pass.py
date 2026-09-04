from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
table = table_path.read_text(encoding='utf-8')
dev = dev_path.read_text(encoding='utf-8')

# ---- table-3d.ts: backend selection + benchmark stages ----
repls = []
repls.append((
"const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';\nconst MODE_KEY = 'mahjong-live:table-3d:v1';\n",
"const THREE_WEBGL_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';\nconst THREE_WEBGPU_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.webgpu.min.js';\nconst MODE_KEY = 'mahjong-live:table-3d:v1';\nconst RENDERER_BACKEND_KEY = 'mahjong-live:renderer-backend:v1';\n"
))
repls.append((
"type Side = 'bottom' | 'top' | 'left' | 'right';\ntype TileZone = 'hand' | 'river' | 'rack' | 'meld';\n",
"type Side = 'bottom' | 'top' | 'left' | 'right';\ntype TileZone = 'hand' | 'river' | 'rack' | 'meld';\ntype BenchmarkStage = 'normal' | 'empty' | 'table' | 'tiles-no-faces' | 'no-shadows';\n"
))
repls.append((
"  staticRiverDirty: boolean;\n  pickMeshes: any[];\n  stressActors: TileActor[];\n};\n",
"  staticRiverDirty: boolean;\n  pickMeshes: any[];\n  stressActors: TileActor[];\n  rendererBackend: 'webgl' | 'webgpu';\n  benchmarkStage: BenchmarkStage;\n};\n"
))
repls.append((
"function loadThree(): Promise<any> {\n  if (!threePromise) {\n    threePromise = import(/* @vite-ignore */ THREE_URL).catch((error) => {\n      threePromise = null;\n      loadError = true;\n      throw error;\n    });\n  }\n  return threePromise;\n}\n",
"function requestedRendererBackend(): 'webgl' | 'webgpu' {\n  return localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl';\n}\n\nfunction loadThree(): Promise<any> {\n  if (!threePromise) {\n    const url = requestedRendererBackend() === 'webgpu' ? THREE_WEBGPU_URL : THREE_WEBGL_URL;\n    threePromise = import(/* @vite-ignore */ url).catch((error) => {\n      threePromise = null;\n      loadError = true;\n      throw error;\n    });\n  }\n  return threePromise;\n}\n"
))

old_create = """function createRuntime(THREE: any): TableRuntime {\n  const tuning = readDevTuning();\n  const renderer = new THREE.WebGLRenderer({\n    alpha: false,\n    antialias: true,\n    powerPreference: 'high-performance',\n  });\n  renderer.setPixelRatio(Math.max(.5, Math.min(2, tuning.graphics.pixelRatio)));\n  renderer.shadowMap.enabled = tuning.graphics.shadowQuality > 0;\n  renderer.shadowMap.type = THREE.PCFSoftShadowMap;\n  // Most of the table is static between actions. Re-rendering the complete shadow map on every\n  // browser frame costs one extra draw for every tile. Cache it and invalidate only when actors move\n  // or tuning/table geometry changes.\n  renderer.shadowMap.autoUpdate = false;\n  renderer.shadowMap.needsUpdate = tuning.graphics.shadowQuality > 0;\n"""
new_create = """function createRuntime(THREE: any): TableRuntime {\n  const tuning = readDevTuning();\n  const wantsWebGpu = requestedRendererBackend() === 'webgpu' && typeof THREE.WebGPURenderer === 'function';\n  const renderer = wantsWebGpu\n    ? new THREE.WebGPURenderer({ alpha: false, antialias: true })\n    : new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });\n  renderer.setPixelRatio(Math.max(.5, Math.min(2, tuning.graphics.pixelRatio)));\n  if (renderer.shadowMap) {\n    renderer.shadowMap.enabled = tuning.graphics.shadowQuality > 0;\n    renderer.shadowMap.type = THREE.PCFSoftShadowMap;\n    // Most of the table is static between actions. Re-render the shadow map only when something\n    // actually moves. WebGPURenderer exposes the same high-level shadowMap surface.\n    renderer.shadowMap.autoUpdate = false;\n    renderer.shadowMap.needsUpdate = tuning.graphics.shadowQuality > 0;\n  }\n"""
repls.append((old_create, new_create))

repls.append((
"  const gl = renderer.getContext();\n  const gpuTimerExt = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext\n    ? gl.getExtension('EXT_disjoint_timer_query_webgl2')\n    : null;\n",
"  const gl = renderer.getContext?.() ?? null;\n  const gpuTimerExt = gl && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext\n    ? gl.getExtension('EXT_disjoint_timer_query_webgl2')\n    : null;\n"
))
repls.append((
"    pickMeshes: [],\n    stressActors: [],\n  };\n",
"    pickMeshes: [],\n    stressActors: [],\n    rendererBackend: wantsWebGpu ? 'webgpu' : 'webgl',\n    benchmarkStage: 'normal',\n  };\n"
))

# Helper for backend-neutral texture filtering.
needle = "function shadowMapSize(level: number): number {\n"
helper = "function rendererMaxAnisotropy(rt: TableRuntime): number {\n  return rt.renderer.capabilities?.getMaxAnisotropy?.() ?? 1;\n}\n\n"
if needle not in table:
    raise SystemExit('shadowMapSize anchor missing')
table = table.replace(needle, helper + needle, 1)

# All current call sites use the same expression.
table = table.replace('rt.renderer.capabilities.getMaxAnisotropy()', 'rendererMaxAnisotropy(rt)')

# applyDevTuning: keep no-shadows benchmark stage authoritative and tolerate WebGPU renderer surface.
repls.append((
"  const shadowSize = shadowMapSize(tuning.graphics.shadowQuality);\n  rt.renderer.shadowMap.enabled = shadowSize > 0;\n  rt.renderer.shadowMap.autoUpdate = false;\n  rt.keyLight.castShadow = shadowSize > 0;\n",
"  const shadowSize = shadowMapSize(tuning.graphics.shadowQuality);\n  const shadowsEnabled = shadowSize > 0 && rt.benchmarkStage !== 'no-shadows';\n  if (rt.renderer.shadowMap) {\n    rt.renderer.shadowMap.enabled = shadowsEnabled;\n    rt.renderer.shadowMap.autoUpdate = false;\n  }\n  rt.keyLight.castShadow = shadowsEnabled;\n"
))
repls.append((
"  if (shadowSize > 0) rt.renderer.shadowMap.needsUpdate = true;\n}\n\nfunction browserRafProbe",
"  if (shadowsEnabled && rt.renderer.shadowMap) rt.renderer.shadowMap.needsUpdate = true;\n  applyBenchmarkVisibility(rt);\n}\n\nfunction browserRafProbe"
))

# Benchmark visibility helpers before browserRafProbe.
anchor = "function browserRafProbe(rt: TableRuntime, time: number): void {\n"
bench_helpers = """function applyBenchmarkVisibility(rt: TableRuntime): void {\n  const stageName = rt.benchmarkStage;\n  const showTable = stageName !== 'empty';\n  const showActors = stageName === 'normal' || stageName === 'tiles-no-faces' || stageName === 'no-shadows';\n  rt.frame.visible = showTable;\n  rt.underlay.visible = showTable;\n  rt.felt.visible = showTable;\n  rt.actorRoot.visible = showActors;\n\n  const hidePrintedFaces = stageName === 'tiles-no-faces';\n  rt.staticBacks.visible = !hidePrintedFaces;\n  for (const batch of rt.staticFaceBatches.values()) batch.visible = !hidePrintedFaces;\n  if (hidePrintedFaces) {\n    for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n      actor.face.visible = false;\n      actor.rear.visible = false;\n    }\n  }\n}\n\nfunction setBenchmarkStage(rt: TableRuntime, stageName: BenchmarkStage): void {\n  const previous = rt.benchmarkStage;\n  rt.benchmarkStage = stageName;\n  if (previous === 'tiles-no-faces' && stageName !== 'tiles-no-faces') {\n    // Restore the exact individual/batched face visibility map after the faces-only diagnostic.\n    rt.staticRiverDirty = true;\n    syncStaticRiverInstances(rt);\n  }\n  const tuning = readDevTuning();\n  const shadowSize = shadowMapSize(tuning.graphics.shadowQuality);\n  const shadowsEnabled = shadowSize > 0 && stageName !== 'no-shadows';\n  if (rt.renderer.shadowMap) {\n    rt.renderer.shadowMap.enabled = shadowsEnabled;\n    if (shadowsEnabled) rt.renderer.shadowMap.needsUpdate = true;\n  }\n  rt.keyLight.castShadow = shadowsEnabled;\n  applyBenchmarkVisibility(rt);\n}\n\nfunction rendererBackendLabel(rt: TableRuntime): string {\n  if (rt.rendererBackend === 'webgl') return 'webgl';\n  if (rt.renderer.backend?.isWebGPUBackend) return 'webgpu';\n  if (rt.renderer.backend?.isWebGLBackend) return 'webgpu-renderer/webgl2-fallback';\n  return 'webgpu-renderer';\n}\n\n"""
if anchor not in table:
    raise SystemExit('browserRafProbe anchor missing')
table = table.replace(anchor, bench_helpers + anchor, 1)

# Keep benchmark visibility after actor reconciliation mutates face visibility.
repls.append((
"  rt.lastRemainingDraws = draws;\n  rt.initialized = true;\n}\n\nfunction syncStaticRiverInstances",
"  rt.lastRemainingDraws = draws;\n  rt.initialized = true;\n  applyBenchmarkVisibility(rt);\n}\n\nfunction syncStaticRiverInstances"
))

# Guard shadow map touches used during batching/motion for WebGPU compatibility.
table = table.replace('if (rt.renderer.shadowMap.enabled) rt.renderer.shadowMap.needsUpdate = true;', 'if (rt.renderer.shadowMap?.enabled) rt.renderer.shadowMap.needsUpdate = true;')
table = table.replace('if (movingCount > 0 && rt.renderer.shadowMap.enabled) rt.renderer.shadowMap.needsUpdate = true;', 'if (movingCount > 0 && rt.renderer.shadowMap?.enabled) rt.renderer.shadowMap.needsUpdate = true;')

# Frame diagnostics: backend + stage and guard renderer.info fields.
repls.append((
"        calls: rt.renderer.info.render.calls,\n        triangles: rt.renderer.info.render.triangles,\n",
"        calls: rt.renderer.info?.render?.calls ?? 0,\n        triangles: rt.renderer.info?.render?.triangles ?? 0,\n"
))
repls.append((
"        faceBatches: [...rt.staticFaceBatches.values()].filter((batch) => batch.count > 0).length,\n        pixelRatio: rt.renderer.getPixelRatio(),\n",
"        faceBatches: [...rt.staticFaceBatches.values()].filter((batch) => batch.count > 0).length,\n        rendererBackend: rendererBackendLabel(rt),\n        benchmarkStage: rt.benchmarkStage,\n        pixelRatio: rt.renderer.getPixelRatio(),\n"
))

# Runtime disposal tolerates WebGPU backend (no forceContextLoss).
repls.append((
"  rt.renderer.dispose();\n  rt.renderer.forceContextLoss?.();\n}\n",
"  rt.renderer.dispose();\n  rt.renderer.forceContextLoss?.();\n}\n"
))

# Backend + benchmark events.
event_anchor = "window.addEventListener('mahjong-live:dev-stress-discards', (event) => {\n"
events = """window.addEventListener('mahjong-live:renderer-backend', (event) => {\n  const backend = (event as CustomEvent<{ backend?: string }>).detail?.backend === 'webgpu' ? 'webgpu' : 'webgl';\n  localStorage.setItem(RENDERER_BACKEND_KEY, backend);\n  disposeRuntime();\n  threePromise = null;\n  loadError = false;\n  scheduleReconcile();\n});\nwindow.addEventListener('mahjong-live:benchmark-stage', (event) => {\n  if (!runtime) return;\n  const raw = (event as CustomEvent<{ stage?: BenchmarkStage }>).detail?.stage ?? 'normal';\n  const allowed: BenchmarkStage[] = ['normal', 'empty', 'table', 'tiles-no-faces', 'no-shadows'];\n  setBenchmarkStage(runtime, allowed.includes(raw) ? raw : 'normal');\n});\n\n"""
if event_anchor not in table:
    raise SystemExit('stress event anchor missing')
table = table.replace(event_anchor, events + event_anchor, 1)

for old, new in repls:
    if old not in table:
        raise SystemExit('Missing table pattern:\n' + old[:300])
    table = table.replace(old, new, 1)

table_path.write_text(table, encoding='utf-8')

# ---- dev-tuning.ts: backend selector + automated benchmark sweep ----
repls = []
repls.append((
"const EVENT_NAME = 'mahjong-live:dev-tuning';\n",
"const EVENT_NAME = 'mahjong-live:dev-tuning';\nconst RENDERER_BACKEND_KEY = 'mahjong-live:renderer-backend:v1';\n"
))
repls.append((
"  faceBatches?: number;\n  pixelRatio?: number;\n",
"  faceBatches?: number;\n  rendererBackend?: string;\n  benchmarkStage?: string;\n  pixelRatio?: number;\n"
))
repls.append((
"let stressDiscardsActive = false;\n",
"let stressDiscardsActive = false;\nlet benchmarkRunning = false;\n"
))
repls.append((
"    String(detail.faceBatches ?? ''),\n    performanceNumber(detail.pixelRatio),\n",
"    String(detail.faceBatches ?? ''),\n    detail.rendererBackend ?? '',\n    detail.benchmarkStage ?? '',\n    performanceNumber(detail.pixelRatio),\n"
))
repls.append((
"      `graphicsSettings\\tpixelRatio=${settings.graphics.pixelRatio}\\tshadowQuality=${settings.graphics.shadowQuality}\\tanisotropy=${settings.graphics.anisotropy}`,\n",
"      `graphicsSettings\\tpixelRatio=${settings.graphics.pixelRatio}\\tshadowQuality=${settings.graphics.shadowQuality}\\tanisotropy=${settings.graphics.anisotropy}`,\n      `rendererPreference\\t${localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl'}\\twebgpuAvailable=${Boolean((navigator as any).gpu)}`,\n"
))
repls.append((
"batched_static_tiles\\tbatched_face_tiles\\tface_batches\\tpixel_ratio",
"batched_static_tiles\\tbatched_face_tiles\\tface_batches\\trenderer_backend\\tbenchmark_stage\\tpixel_ratio"
))

# Benchmark runner before applyDomPreview.
anchor = "function applyDomPreview(): void {\n"
runner = """function sleepBenchmark(ms: number): Promise<void> {\n  return new Promise((resolve) => window.setTimeout(resolve, ms));\n}\n\nasync function runBenchmarkSweep(): Promise<void> {\n  if (benchmarkRunning) return;\n  benchmarkRunning = true;\n  const startedCaptureHere = !performanceCapture;\n  if (startedCaptureHere) startPerformanceCapture();\n  if (!stressDiscardsActive) {\n    stressDiscardsActive = true;\n    window.dispatchEvent(new CustomEvent('mahjong-live:dev-stress-discards', { detail: { enabled: true } }));\n    panel?.querySelector<HTMLButtonElement>('.perf-stress-fill')?.replaceChildren(document.createTextNode('Clear simulated discards'));\n    await sleepBenchmark(900);\n  }\n\n  const stages: Array<[string, string]> = [\n    ['normal', '1/5 full scene'],\n    ['empty', '2/5 empty renderer'],\n    ['table', '3/5 table only'],\n    ['tiles-no-faces', '4/5 tiles without printed faces'],\n    ['no-shadows', '5/5 full scene without shadows'],\n  ];\n  try {\n    for (const [stageName, label] of stages) {\n      setStatus(`Benchmark ${label}…`);\n      window.dispatchEvent(new CustomEvent('mahjong-live:benchmark-stage', { detail: { stage: stageName } }));\n      await sleepBenchmark(2800);\n    }\n  } finally {\n    window.dispatchEvent(new CustomEvent('mahjong-live:benchmark-stage', { detail: { stage: 'normal' } }));\n    benchmarkRunning = false;\n    if (startedCaptureHere && performanceCapture) stopPerformanceCapture();\n    else setStatus('Benchmark sweep complete; renderer restored to normal.');\n  }\n}\n\n"""
if anchor not in dev:
    raise SystemExit('applyDomPreview anchor missing')
dev = dev.replace(anchor, runner + anchor, 1)

# Add backend selector after graphics heading, before sliders.
repls.append((
"  graphics.innerHTML = '<h3>Performance & graphics</h3>';\n  numberSlider(graphics, 'Pixel ratio',",
"  graphics.innerHTML = '<h3>Performance & graphics</h3>';\n  const rendererRow = document.createElement('div');\n  rendererRow.className = 'dev-tuning-presets';\n  const rendererLabel = document.createElement('label'); rendererLabel.textContent = 'Renderer';\n  const rendererSelect = document.createElement('select');\n  const rendererOptions: [string, string][] = [['WebGL 2', 'webgl'], ['WebGPU (experimental)', 'webgpu']];\n  rendererOptions.forEach(([name, value]) => { const option = document.createElement('option'); option.textContent = name; option.value = value; rendererSelect.append(option); });\n  rendererSelect.value = localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl';\n  rendererSelect.addEventListener('change', () => {\n    localStorage.setItem(RENDERER_BACKEND_KEY, rendererSelect.value);\n    window.dispatchEvent(new CustomEvent('mahjong-live:renderer-backend', { detail: { backend: rendererSelect.value } }));\n    setStatus(rendererSelect.value === 'webgpu' ? 'Switching to experimental WebGPURenderer…' : 'Switching to WebGL renderer…');\n  });\n  rendererRow.append(rendererLabel, rendererSelect);\n  graphics.append(rendererRow);\n  numberSlider(graphics, 'Pixel ratio',"
))

# Add automated benchmark button beside stress fill.
repls.append((
"  stressActions.append(stressButton);\n  graphics.append(stressActions);\n",
"  const benchmarkButton = document.createElement('button');\n  benchmarkButton.type = 'button';\n  benchmarkButton.className = 'dev-tuning-action perf-benchmark-run';\n  benchmarkButton.textContent = 'Run benchmark sweep';\n  benchmarkButton.addEventListener('click', () => void runBenchmarkSweep());\n  stressActions.append(stressButton, benchmarkButton);\n  graphics.append(stressActions);\n"
))

# Replace note with backend/benchmark explanation.
old_note = '<p class="dev-tuning-note">Diagnostics now compare the Three.js loop with an independent browser RAF probe and, when EXT_disjoint_timer_query_webgl2 is available, real GPU execution time. Settled non-selectable bodies/shells/backs and printed fronts are instanced, shadow maps are cached, and tile meshes now use much lighter rounded geometry. Watch the triangle count in the log: this pass targets the remaining vertex/geometry cost rather than raster resolution. Start performance log records one tab-separated sample per diagnostic interval until Stop & save .txt; logging continues even if the Dev panel is closed.</p>'
new_note = '<p class="dev-tuning-note">Renderer can now be switched live between WebGL 2 and experimental Three.js WebGPURenderer (which may itself fall back to WebGL 2 if WebGPU is unavailable). Run benchmark sweep fills the rivers, then records the same scene as: full, empty renderer, table only, tiles without printed faces, and full scene without shadows. The generated TXT includes renderer_backend and benchmark_stage so we can finally isolate browser/driver cost from scene cost.</p>'
repls.append((old_note, new_note))

# Make visible diagnostics show backend + stage.
repls.append((
"  target.textContent = `Loop ${loopHz} · RAF ${rafHz} · ${gpuMs} · ${detail.calls ?? 0} calls · ${detail.actors ?? 0} tiles`;\n",
"  target.textContent = `${detail.rendererBackend ?? 'renderer'} · ${detail.benchmarkStage ?? 'normal'} · Loop ${loopHz} · RAF ${rafHz} · ${gpuMs} · ${detail.calls ?? 0} calls · ${detail.actors ?? 0} tiles`;\n"
))
repls.append((
" · ${(detail.pixelRatio ?? 1).toFixed(2)}× pixel ratio · ${detail.visibility ?? document.visibilityState}`;\n",
" · ${(detail.pixelRatio ?? 1).toFixed(2)}× pixel ratio · backend ${detail.rendererBackend ?? ''} · stage ${detail.benchmarkStage ?? ''} · ${detail.visibility ?? document.visibilityState}`;\n"
))

for old, new in repls:
    if old not in dev:
        raise SystemExit('Missing dev pattern:\n' + old[:300])
    dev = dev.replace(old, new, 1)

dev_path.write_text(dev, encoding='utf-8')
print('WebGPU selector + benchmark sweep applied')
