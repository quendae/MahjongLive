from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
table = table_path.read_text(encoding='utf-8')
dev = dev_path.read_text(encoding='utf-8')

# -----------------------------------------------------------------------------
# 1. One face atlas instead of 37 independent CanvasTextures/material bindings.
# The benchmark proves the printed-face path is the dominant cost: bodies without
# printed faces run ~250 Hz while the same scene with faces falls to ~32 Hz.
# -----------------------------------------------------------------------------
anchor = "const DEV_TUNING_KEY = 'mahjong-live:dev-tuning:v1';\n"
insert = """const DEV_TUNING_KEY = 'mahjong-live:dev-tuning:v1';
const FACE_ATLAS_LABELS = [
  '1m','2m','3m','4m','5m','6m','7m','8m','9m',
  '1p','2p','3p','4p','5p','6p','7p','8p','9p',
  '1s','2s','3s','4s','5s','6s','7s','8s','9s',
  'red 5m','red 5p','red 5s',
  'east','south','west','north','white dragon','green dragon','red dragon',
] as const;
const FACE_ATLAS_COLUMNS = 8;
const FACE_ATLAS_ROWS = 5;
const FACE_ATLAS_CELL_W = 256;
const FACE_ATLAS_CELL_H = 344;
const FACE_ATLAS_PAD = 4;
"""
if anchor not in table:
    raise SystemExit('DEV_TUNING_KEY anchor missing')
table = table.replace(anchor, insert, 1)

old_fields = """  faceMaterials: Map<string, any>;
  actors: Map<string, TileActor>;
"""
new_fields = """  faceMaterials: Map<string, any>;
  faceAtlasTexture: any | null;
  faceAtlasMaterial: any;
  faceGeometries: Map<string, any>;
  faceGeometryRotation: number;
  actors: Map<string, TileActor>;
"""
if old_fields not in table:
    raise SystemExit('TableRuntime face fields anchor missing')
table = table.replace(old_fields, new_fields, 1)

start = table.index('function disposeFaceMaterials(rt: TableRuntime): void {')
end = table.index('function createActor(rt: TableRuntime, spec: TileSpec, initial: Transform): TileActor {', start)
atlas_block = r'''function disposeFaceGeometries(rt: TableRuntime): void {
  for (const geometry of rt.faceGeometries.values()) geometry.dispose?.();
  rt.faceGeometries.clear();
}

function disposeFaceMaterials(rt: TableRuntime): void {
  rt.faceAtlasTexture?.dispose?.();
  rt.faceAtlasTexture = null;
  rt.faceAtlasMaterial?.dispose?.();
  rt.faceMaterials.clear();
  disposeFaceGeometries(rt);
}

function normalizedFaceLabel(label: string | null): string {
  return label?.trim().toLowerCase() ?? '';
}

function faceAtlasIndex(label: string | null): number {
  const normalized = normalizedFaceLabel(label);
  const index = FACE_ATLAS_LABELS.indexOf(normalized as (typeof FACE_ATLAS_LABELS)[number]);
  // Standard gameplay labels are all represented above. Keep an unused final cell as a safe blank
  // fallback instead of binding a new one-off texture if an unexpected label appears in dev data.
  return index >= 0 ? index : FACE_ATLAS_COLUMNS * FACE_ATLAS_ROWS - 1;
}

function rebuildFaceAtlas(rt: TableRuntime): void {
  const THREE = rt.THREE;
  const atlasWidth = FACE_ATLAS_COLUMNS * FACE_ATLAS_CELL_W;
  const atlasHeight = FACE_ATLAS_ROWS * FACE_ATLAS_CELL_H;
  const drawWidth = FACE_ATLAS_CELL_W - FACE_ATLAS_PAD * 2;
  const drawHeight = FACE_ATLAS_CELL_H - FACE_ATLAS_PAD * 2;
  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, atlasWidth, atlasHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  rt.faceAtlasTexture?.dispose?.();
  let texture: any = null;
  const mode = rt.faceMode;
  FACE_ATLAS_LABELS.forEach((label, index) => {
    const col = index % FACE_ATLAS_COLUMNS;
    const row = Math.floor(index / FACE_ATLAS_COLUMNS);
    const x = col * FACE_ATLAS_CELL_W + FACE_ATLAS_PAD;
    const y = row * FACE_ATLAS_CELL_H + FACE_ATLAS_PAD;
    let source: HTMLCanvasElement;
    const repaint = () => {
      if (!texture || rt.disposed || rt.faceMode !== mode || rt.faceAtlasTexture !== texture) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(col * FACE_ATLAS_CELL_W, row * FACE_ATLAS_CELL_H, FACE_ATLAS_CELL_W, FACE_ATLAS_CELL_H);
      ctx.drawImage(source, x, y, drawWidth, drawHeight);
      texture.needsUpdate = true;
    };
    source = createFaceCanvas(label, false, mode, repaint);
    ctx.drawImage(source, x, y, drawWidth, drawHeight);
  });

  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // One non-mipmapped atlas is both cheaper and more stable than dozens of independent mip chains.
  // The 4px white gutter around every cell prevents linear filtering from bleeding neighbouring art.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(readDevTuning().graphics.anisotropy, rendererMaxAnisotropy(rt));
  rt.faceAtlasTexture = texture;
  rt.faceAtlasMaterial.map = texture;
  rt.faceAtlasMaterial.color.set(readDevTuning().tiles.faceTint);
  rt.faceAtlasMaterial.needsUpdate = true;
}

function faceGeometryForLabel(rt: TableRuntime, label: string | null): any {
  const index = faceAtlasIndex(label);
  const rotation = rt.faceGeometryRotation;
  const key = `${index}:${rotation.toFixed(3)}`;
  const cached = rt.faceGeometries.get(key);
  if (cached) return cached;

  const geometry = rt.faceGeometry.clone();
  const uvs = geometry.getAttribute('uv');
  const col = index % FACE_ATLAS_COLUMNS;
  const row = Math.floor(index / FACE_ATLAS_COLUMNS);
  const atlasWidth = FACE_ATLAS_COLUMNS * FACE_ATLAS_CELL_W;
  const atlasHeight = FACE_ATLAS_ROWS * FACE_ATLAS_CELL_H;
  const drawWidth = FACE_ATLAS_CELL_W - FACE_ATLAS_PAD * 2;
  const drawHeight = FACE_ATLAS_CELL_H - FACE_ATLAS_PAD * 2;
  const leftPx = col * FACE_ATLAS_CELL_W + FACE_ATLAS_PAD;
  const topPx = row * FACE_ATLAS_CELL_H + FACE_ATLAS_PAD;
  const angle = radians(rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let vertex = 0; vertex < uvs.count; vertex += 1) {
    const sourceU = uvs.getX(vertex) - .5;
    const sourceV = uvs.getY(vertex) - .5;
    const localU = Math.max(0, Math.min(1, sourceU * cos - sourceV * sin + .5));
    const localV = Math.max(0, Math.min(1, sourceU * sin + sourceV * cos + .5));
    const atlasU = (leftPx + localU * drawWidth) / atlasWidth;
    const atlasV = 1 - (topPx + (1 - localV) * drawHeight) / atlasHeight;
    uvs.setXY(vertex, atlasU, atlasV);
  }
  uvs.needsUpdate = true;
  rt.faceGeometries.set(key, geometry);
  return geometry;
}

function syncFaceGeometryRotation(rt: TableRuntime, rotation: number): void {
  if (Math.abs(rt.faceGeometryRotation - rotation) < .0001) return;
  rt.faceGeometryRotation = rotation;
  disposeFaceGeometries(rt);
  clearStaticFaceBatches(rt);
  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {
    actor.face.geometry = faceGeometryForLabel(rt, actor.spec.label);
  }
  rt.staticRiverDirty = true;
}

function materialForFace(rt: TableRuntime, _label: string | null, back = false): any {
  return back ? rt.ivoryMaterial : rt.faceAtlasMaterial;
}

function clearStaticFaceBatches(rt: TableRuntime): void {
  for (const batch of rt.staticFaceBatches.values()) {
    batch.removeFromParent();
    batch.dispose?.();
  }
  rt.staticFaceBatches.clear();
  rt.staticFaceCount = 0;
}

function staticFaceBatchKey(rt: TableRuntime, label: string | null): string {
  return `${rt.faceMode}:${normalizedFaceLabel(label) || 'blank'}`;
}

function ensureStaticFaceBatch(rt: TableRuntime, label: string | null): any {
  const key = staticFaceBatchKey(rt, label);
  const existing = rt.staticFaceBatches.get(key);
  if (existing) return existing;
  const batch = new rt.THREE.InstancedMesh(
    faceGeometryForLabel(rt, label),
    rt.faceAtlasMaterial,
    rt.staticFaceBatchCapacity,
  );
  batch.count = 0;
  batch.castShadow = false;
  batch.receiveShadow = false;
  batch.frustumCulled = false;
  batch.renderOrder = 4;
  batch.instanceMatrix.setUsage(rt.THREE.DynamicDrawUsage);
  rt.actorRoot.add(batch);
  rt.staticFaceBatches.set(key, batch);
  return batch;
}

function syncFaceMode(rt: TableRuntime): void {
  const next = readFaceMode();
  if (next === rt.faceMode) return;
  rt.faceMode = next;
  clearStaticFaceBatches(rt);
  rebuildFaceAtlas(rt);
  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {
    actor.face.geometry = faceGeometryForLabel(rt, actor.spec.label);
    actor.face.material = rt.faceAtlasMaterial;
  }
  rt.staticRiverDirty = true;
}

'''
table = table[:start] + atlas_block + table[end:]

old = '  const face = new THREE.Mesh(rt.faceGeometry, materialForFace(rt, spec.label, spec.back));\n'
new = '  const face = new THREE.Mesh(faceGeometryForLabel(rt, spec.label), materialForFace(rt, spec.label, spec.back));\n'
if old not in table:
    raise SystemExit('createActor face geometry line missing')
table = table.replace(old, new, 1)

old = """  const changedFace = actor.spec.label !== spec.label || actor.spec.back !== spec.back;
  actor.spec = spec;
  if (changedFace) actor.face.material = materialForFace(rt, spec.label, spec.back);
"""
new = """  const changedFace = actor.spec.label !== spec.label || actor.spec.back !== spec.back;
  actor.spec = spec;
  if (changedFace) {
    actor.face.geometry = faceGeometryForLabel(rt, spec.label);
    actor.face.material = materialForFace(rt, spec.label, spec.back);
  }
"""
if old not in table:
    raise SystemExit('refreshActor changedFace block missing')
table = table.replace(old, new, 1)

# Create one shared material for the atlas before building the runtime object.
anchor = """  const backShellMaterial = new THREE.MeshStandardMaterial({
    color: tuning.backColor, roughness: .58, metalness: 0,
  });

  // Batch shared geometry"""
replacement = """  const backShellMaterial = new THREE.MeshStandardMaterial({
    color: tuning.backColor, roughness: .58, metalness: 0,
  });
  const faceAtlasMaterial = new THREE.MeshLambertMaterial({
    map: null,
    color: tuning.tiles.faceTint,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const faceMaterials = new Map<string, any>([['atlas', faceAtlasMaterial]]);

  // Batch shared geometry"""
if anchor not in table:
    raise SystemExit('backShellMaterial anchor missing')
table = table.replace(anchor, replacement, 1)

old = '    faceMaterials: new Map(),\n    actors: new Map(),\n'
new = """    faceMaterials,
    faceAtlasTexture: null,
    faceAtlasMaterial,
    faceGeometries: new Map(),
    faceGeometryRotation: tuning.tiles.faceTextureRotation,
    actors: new Map(),
"""
if old not in table:
    raise SystemExit('runtime faceMaterials initializer missing')
table = table.replace(old, new, 1)

old = '  applyDevTuning(rt);\n  renderer.setAnimationLoop((time: number) => frameRuntime(rt, time));\n'
new = '  rebuildFaceAtlas(rt);\n  applyDevTuning(rt);\n  renderer.setAnimationLoop((time: number) => frameRuntime(rt, time));\n'
if old not in table:
    raise SystemExit('runtime finalization anchor missing')
table = table.replace(old, new, 1)

# Atlas texture rotation is baked into the per-label UV geometry. Never rotate the whole atlas map.
old = """  for (const material of rt.faceMaterials.values()) {
    material.color?.set?.(tuning.tiles.faceTint);
    if (material.map) {
      material.map.center.set(.5, .5);
      material.map.rotation = radians(tuning.tiles.faceTextureRotation);
      material.map.needsUpdate = true;
    }
  }
  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {
"""
new = """  syncFaceGeometryRotation(rt, tuning.tiles.faceTextureRotation);
  for (const material of rt.faceMaterials.values()) {
    material.color?.set?.(tuning.tiles.faceTint);
    if (material.map) material.map.needsUpdate = true;
  }
  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {
"""
if old not in table:
    raise SystemExit('applyDevTuning face material block missing')
table = table.replace(old, new, 1)

# -----------------------------------------------------------------------------
# 2. WebGPU: explicitly initialize the async backend before using capabilities.
# Three's docs allow setAnimationLoop to initialize lazily, but this app immediately touches
# renderer state during setup; explicit init gives deterministic errors and avoids the 2D fallback.
# -----------------------------------------------------------------------------
old = 'function createRuntime(THREE: any): TableRuntime {\n'
new = 'async function createRuntime(THREE: any): Promise<TableRuntime> {\n'
if old not in table:
    raise SystemExit('createRuntime signature missing')
table = table.replace(old, new, 1)

old = """  const renderer = wantsWebGpu
    ? new THREE.WebGPURenderer({ alpha: false, antialias: true })
    : new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio"""
new = """  const renderer = wantsWebGpu
    ? new THREE.WebGPURenderer({ alpha: false, antialias: true })
    : new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
  if (wantsWebGpu && typeof renderer.init === 'function') await renderer.init();
  renderer.setPixelRatio"""
if old not in table:
    raise SystemExit('renderer constructor block missing')
table = table.replace(old, new, 1)

old = '      runtime = createRuntime(THREE);\n'
new = '      runtime = await createRuntime(THREE);\n'
if old not in table:
    raise SystemExit('reconcile createRuntime call missing')
table = table.replace(old, new, 1)

# Put the actual renderer error in the visible fallback note so WebGPU failures are actionable.
old = """    } catch (error) {
      console.warn('Mahjong Live 3D renderer unavailable; keeping 2D table.', error);
      fallbackNote(table, '3D renderer unavailable — using the fully playable 2D table.');
      updateModeButton();
      return;
    }
"""
new = """    } catch (error) {
      console.warn('Mahjong Live 3D renderer unavailable; keeping 2D table.', error);
      const detail = error instanceof Error ? error.message : String(error);
      fallbackNote(table, `3D renderer unavailable — ${detail || 'unknown renderer error'}. Using the fully playable 2D table.`);
      updateModeButton();
      return;
    }
"""
if old not in table:
    raise SystemExit('renderer catch block missing')
table = table.replace(old, new, 1)

table_path.write_text(table, encoding='utf-8')

# Update dev copy to explain the new atlas and make the benchmark interpretation obvious.
old_note = "Renderer can now be switched live between WebGL 2 and experimental Three.js WebGPURenderer (which may itself fall back to WebGL 2 if WebGPU is unavailable). Run benchmark sweep fills the rivers, then records the same scene as: full, empty renderer, table only, tiles without printed faces, and full scene without shadows. The generated TXT includes renderer_backend and benchmark_stage so we can finally isolate browser/driver cost from scene cost."
new_note = "Renderer can be switched live between WebGL 2 and experimental Three.js WebGPURenderer. Printed tile art now shares one atlas texture/material instead of dozens of CanvasTextures — the previous benchmark isolated texture/material switching as the dominant bottleneck. Run benchmark sweep still records full, empty, table only, tiles without printed faces, and full scene without shadows. TXT includes renderer_backend and benchmark_stage."
if old_note not in dev:
    raise SystemExit('dev benchmark note missing')
dev = dev.replace(old_note, new_note, 1)
dev_path.write_text(dev, encoding='utf-8')

print('Applied single-atlas tile faces and explicit WebGPU initialization.')
