from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
table = table_path.read_text(encoding='utf-8')
dev = dev_path.read_text(encoding='utf-8')

old = """function requestedRendererBackend(): 'webgl' | 'webgpu' {
  const requested = localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl';
  // Firefox can expose navigator.gpu while Three's WebGPURenderer still wedges the tab/driver.
  // Do not let a saved experimental preference lock the game into the 2D fallback there.
  if (requested === 'webgpu' && isFirefoxBrowser()) {
    localStorage.setItem(RENDERER_BACKEND_KEY, 'webgl');
    sessionStorage.setItem('mahjong-live:webgpu-fallback', 'WebGPU disabled on Firefox after an unstable renderer initialization; WebGL 2 restored.');
    return 'webgl';
  }
  return requested;
}
"""
new = """function requestedRendererBackend(): 'webgl' | 'webgpu' {
  const stored = localStorage.getItem(RENDERER_BACKEND_KEY);
  const requested: 'webgl' | 'webgpu' = stored === 'webgl' || stored === 'webgpu'
    ? stored
    : (!isFirefoxBrowser() && Boolean((navigator as any).gpu) ? 'webgpu' : 'webgl');
  // Firefox can expose navigator.gpu while Three's WebGPURenderer still wedges the tab/driver.
  // Do not let a saved experimental preference lock the game into the 2D fallback there.
  if (requested === 'webgpu' && isFirefoxBrowser()) {
    localStorage.setItem(RENDERER_BACKEND_KEY, 'webgl');
    sessionStorage.setItem('mahjong-live:webgpu-fallback', 'WebGPU disabled on Firefox after an unstable renderer initialization; WebGL 2 restored.');
    return 'webgl';
  }
  return requested;
}
"""
if old not in table:
    raise SystemExit('requestedRendererBackend anchor missing')
table = table.replace(old, new, 1)

old = """  const renderStarted = performance.now();
  const gpuTimerStarted = beginGpuTimer(rt);
  rt.renderer.render(rt.scene, rt.camera);
"""
new = """  const renderStarted = performance.now();
  const gpuTimerStarted = beginGpuTimer(rt);
  // WebGPURenderer currently accumulates renderer.info counters across frames while WebGL usually
  // resets them automatically. Reset explicitly so diagnostics mean the same thing on both backends.
  rt.renderer.info?.reset?.();
  rt.renderer.render(rt.scene, rt.camera);
"""
if old not in table:
    raise SystemExit('render anchor missing')
table = table.replace(old, new, 1)

table_path.write_text(table, encoding='utf-8')

old = """type PerformanceCapture = {
  startedAt: number;
  startedIso: string;
  lines: string[];
  samples: number;
};
"""
new = """type PerformanceCapture = {
  startedAt: number;
  startedIso: string;
  lines: string[];
  samples: number;
  lastSampleAt: number;
};
"""
if old not in dev:
    raise SystemExit('PerformanceCapture type anchor missing')
dev = dev.replace(old, new, 1)

old = """function appendPerformanceSample(detail: PerformanceDetail): void {
  const capture = performanceCapture;
  if (!capture) return;
  const now = new Date();
  const elapsed = (performance.now() - capture.startedAt) / 1000;
"""
new = """function appendPerformanceSample(detail: PerformanceDetail): void {
  const capture = performanceCapture;
  if (!capture) return;
  const sampleAt = performance.now();
  // Switching/render benchmark stages can briefly leave overlapping renderer callbacks alive.
  // Keep the TXT useful and deterministic: at most one row per ~0.5 s capture interval.
  if (capture.lastSampleAt > 0 && sampleAt - capture.lastSampleAt < 500) return;
  capture.lastSampleAt = sampleAt;
  const now = new Date();
  const elapsed = (sampleAt - capture.startedAt) / 1000;
"""
if old not in dev:
    raise SystemExit('appendPerformanceSample anchor missing')
dev = dev.replace(old, new, 1)

old = """    startedAt: performance.now(),
    startedIso: started.toISOString(),
    samples: 0,
    lines: [
"""
new = """    startedAt: performance.now(),
    startedIso: started.toISOString(),
    samples: 0,
    lastSampleAt: 0,
    lines: [
"""
if old not in dev:
    raise SystemExit('capture initializer anchor missing')
dev = dev.replace(old, new, 1)

old = """      `rendererPreference\\t${localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl'}\\twebgpuAvailable=${Boolean((navigator as any).gpu)}`,
"""
new = """      `rendererPreference\\t${localStorage.getItem(RENDERER_BACKEND_KEY) ?? (!/Firefox\\//.test(navigator.userAgent) && Boolean((navigator as any).gpu) ? 'webgpu-auto' : 'webgl-auto')}\\twebgpuAvailable=${Boolean((navigator as any).gpu)}`,
"""
if old not in dev:
    raise SystemExit('rendererPreference log line missing')
dev = dev.replace(old, new, 1)

old = """  if (firefoxWebGpuBlocked && localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu') {
    localStorage.setItem(RENDERER_BACKEND_KEY, 'webgl');
  }
  rendererSelect.value = localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl';
"""
new = """  if (firefoxWebGpuBlocked && localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu') {
    localStorage.setItem(RENDERER_BACKEND_KEY, 'webgl');
  }
  const storedRenderer = localStorage.getItem(RENDERER_BACKEND_KEY);
  rendererSelect.value = storedRenderer === 'webgpu' || storedRenderer === 'webgl'
    ? storedRenderer
    : (!firefoxWebGpuBlocked && webGpuApiAvailable ? 'webgpu' : 'webgl');
"""
if old not in dev:
    raise SystemExit('renderer select initial value anchor missing')
dev = dev.replace(old, new, 1)

old = """  graphics.insertAdjacentHTML('beforeend', `<p class=\"dev-tuning-note\">Printed tile art shares one atlas texture/material. WebGPU remains experimental and is disabled on Firefox because the current Three.js/Firefox path can hang the tab even when navigator.gpu is exposed; Chromium/Edge may still test it, with a 4 s initialization timeout and automatic WebGL 2 fallback. Run benchmark sweep records full, empty, table only, tiles without printed faces, and full scene without shadows.</p>`);
"""
new = """  graphics.insertAdjacentHTML('beforeend', `<p class=\"dev-tuning-note\">Printed tile art shares one atlas texture/material. On Chromium/Edge with WebGPU available, WebGPU is now the automatic default unless you explicitly choose another backend; Firefox stays on WebGL 2 because its current Three.js WebGPU path can hang the tab. WebGPU keeps a 4 s initialization timeout and automatic WebGL fallback. Performance TXT is rate-limited to one clean sample per interval and renderer.info is reset per frame on both backends.</p>`);
"""
if old not in dev:
    raise SystemExit('graphics note anchor missing')
dev = dev.replace(old, new, 1)

dev_path.write_text(dev, encoding='utf-8')
