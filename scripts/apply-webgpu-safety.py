from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
table = table_path.read_text(encoding='utf-8')
dev = dev_path.read_text(encoding='utf-8')

old = """function requestedRendererBackend(): 'webgl' | 'webgpu' {
  return localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl';
}

function loadThree(): Promise<any> {
"""
new = """function isFirefoxBrowser(): boolean {
  return /Firefox\\//.test(navigator.userAgent);
}

function requestedRendererBackend(): 'webgl' | 'webgpu' {
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

async function initializeWebGpuRenderer(renderer: any): Promise<void> {
  if (typeof renderer.init !== 'function') return;
  const init = renderer.init();
  if (!init || typeof init.then !== 'function') return;
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('WebGPU initialization timed out after 4 seconds')), 4000);
  });
  try {
    await Promise.race([init, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

function loadThree(): Promise<any> {
"""
if old not in table:
    raise SystemExit('requestedRendererBackend block not found')
table = table.replace(old, new, 1)

old = "  if (wantsWebGpu && typeof renderer.init === 'function') await renderer.init();\n"
new = "  if (wantsWebGpu) await initializeWebGpuRenderer(renderer);\n"
if old not in table:
    raise SystemExit('renderer init line not found')
table = table.replace(old, new, 1)

old = """    } catch (error) {
      console.warn('Mahjong Live 3D renderer unavailable; keeping 2D table.', error);
      const detail = error instanceof Error ? error.message : String(error);
      fallbackNote(table, `3D renderer unavailable — ${detail || 'unknown renderer error'}. Using the fully playable 2D table.`);
      updateModeButton();
      return;
    }
"""
new = """    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const requestedWebGpu = localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu';
      if (requestedWebGpu) {
        console.warn('Mahjong Live WebGPU renderer failed; restoring WebGL 2.', error);
        localStorage.setItem(RENDERER_BACKEND_KEY, 'webgl');
        sessionStorage.setItem('mahjong-live:webgpu-fallback', `WebGPU failed: ${detail || 'unknown renderer error'}. WebGL 2 restored automatically.`);
        threePromise = null;
        loadError = false;
        stage.replaceChildren();
        scheduleReconcile();
        return;
      }
      console.warn('Mahjong Live 3D renderer unavailable; keeping 2D table.', error);
      fallbackNote(table, `3D renderer unavailable — ${detail || 'unknown renderer error'}. Using the fully playable 2D table.`);
      updateModeButton();
      return;
    }
"""
if old not in table:
    raise SystemExit('reconcile catch block not found')
table = table.replace(old, new, 1)

table_path.write_text(table, encoding='utf-8')

old = """  const rendererSelect = document.createElement('select');
  const rendererOptions: [string, string][] = [['WebGL 2', 'webgl'], ['WebGPU (experimental)', 'webgpu']];
  rendererOptions.forEach(([name, value]) => { const option = document.createElement('option'); option.textContent = name; option.value = value; rendererSelect.append(option); });
  rendererSelect.value = localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl';
  rendererSelect.addEventListener('change', () => {
    localStorage.setItem(RENDERER_BACKEND_KEY, rendererSelect.value);
    window.dispatchEvent(new CustomEvent('mahjong-live:renderer-backend', { detail: { backend: rendererSelect.value } }));
    setStatus(rendererSelect.value === 'webgpu' ? 'Switching to experimental WebGPURenderer…' : 'Switching to WebGL renderer…');
  });
"""
new = """  const rendererSelect = document.createElement('select');
  const firefoxWebGpuBlocked = /Firefox\\//.test(navigator.userAgent);
  const webGpuApiAvailable = Boolean((navigator as any).gpu);
  const rendererOptions: [string, string][] = [
    ['WebGL 2', 'webgl'],
    [firefoxWebGpuBlocked ? 'WebGPU (disabled on Firefox)' : 'WebGPU (experimental)', 'webgpu'],
  ];
  rendererOptions.forEach(([name, value]) => {
    const option = document.createElement('option');
    option.textContent = name;
    option.value = value;
    if (value === 'webgpu' && (firefoxWebGpuBlocked || !webGpuApiAvailable)) option.disabled = true;
    rendererSelect.append(option);
  });
  if (firefoxWebGpuBlocked && localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu') {
    localStorage.setItem(RENDERER_BACKEND_KEY, 'webgl');
  }
  rendererSelect.value = localStorage.getItem(RENDERER_BACKEND_KEY) === 'webgpu' ? 'webgpu' : 'webgl';
  rendererSelect.addEventListener('change', () => {
    if (rendererSelect.value === 'webgpu' && (firefoxWebGpuBlocked || !webGpuApiAvailable)) {
      rendererSelect.value = 'webgl';
      localStorage.setItem(RENDERER_BACKEND_KEY, 'webgl');
      setStatus(firefoxWebGpuBlocked ? 'WebGPU is disabled on Firefox because the current Three.js backend can hang the tab. Use Chromium/Edge for that experiment.' : 'WebGPU API is not available in this browser.');
      return;
    }
    localStorage.setItem(RENDERER_BACKEND_KEY, rendererSelect.value);
    window.dispatchEvent(new CustomEvent('mahjong-live:renderer-backend', { detail: { backend: rendererSelect.value } }));
    setStatus(rendererSelect.value === 'webgpu' ? 'Switching to experimental WebGPURenderer… automatic WebGL fallback is enabled.' : 'Switching to WebGL renderer…');
  });
"""
if old not in dev:
    raise SystemExit('renderer selector block not found')
dev = dev.replace(old, new, 1)

old = """  graphics.insertAdjacentHTML('beforeend', '<p class=\"dev-tuning-note\">Renderer can be switched live between WebGL 2 and experimental Three.js WebGPURenderer. Printed tile art now shares one atlas texture/material instead of dozens of CanvasTextures — the previous benchmark isolated texture/material switching as the dominant bottleneck. Run benchmark sweep still records full, empty, table only, tiles without printed faces, and full scene without shadows. TXT includes renderer_backend and benchmark_stage.</p>');
  root.append(graphics);
  requestAnimationFrame(updatePerformanceCaptureUi);
"""
new = """  graphics.insertAdjacentHTML('beforeend', `<p class=\"dev-tuning-note\">Printed tile art shares one atlas texture/material. WebGPU remains experimental and is disabled on Firefox because the current Three.js/Firefox path can hang the tab even when navigator.gpu is exposed; Chromium/Edge may still test it, with a 4 s initialization timeout and automatic WebGL 2 fallback. Run benchmark sweep records full, empty, table only, tiles without printed faces, and full scene without shadows.</p>`);
  root.append(graphics);
  const webGpuFallback = sessionStorage.getItem('mahjong-live:webgpu-fallback');
  if (webGpuFallback) {
    sessionStorage.removeItem('mahjong-live:webgpu-fallback');
    requestAnimationFrame(() => setStatus(webGpuFallback));
  }
  requestAnimationFrame(updatePerformanceCaptureUi);
"""
if old not in dev:
    raise SystemExit('graphics note block not found')
dev = dev.replace(old, new, 1)

dev_path.write_text(dev, encoding='utf-8')
