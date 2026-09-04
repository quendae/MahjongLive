from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
table = table_path.read_text(encoding='utf-8')
dev = dev_path.read_text(encoding='utf-8')

# ---- table-3d.ts ----
table = table.replace(
    "graphics: { pixelRatio: number; shadowQuality: number; anisotropy: number };",
    "graphics: { pixelRatio: number; shadowQuality: number; anisotropy: number; geometryQuality: number };",
    1,
)
table = table.replace(
    "graphics: { pixelRatio: 1.0, shadowQuality: 1, anisotropy: 4 },",
    "graphics: { pixelRatio: 1.0, shadowQuality: 1, anisotropy: 4, geometryQuality: 1 },",
    1,
)
table = table.replace(
    "      anisotropy: finiteNumber(raw.graphics?.anisotropy, DEFAULT_DEV_TUNING.graphics.anisotropy),\n",
    "      anisotropy: finiteNumber(raw.graphics?.anisotropy, DEFAULT_DEV_TUNING.graphics.anisotropy),\n      geometryQuality: finiteNumber(raw.graphics?.geometryQuality, DEFAULT_DEV_TUNING.graphics.geometryQuality),\n",
    1,
)

# Add runtime field.
table = table.replace(
    "  infoCallsAtSampleStart: number;\n};",
    "  infoCallsAtSampleStart: number;\n  geometryQuality: number;\n};",
    1,
)

# Replace geometry helpers with quality-aware variants.
start = table.index("function roundedTileGeometry(THREE: any): any {")
end = table.index("\nfunction disposeFaceGeometries(rt: TableRuntime): void {", start)
replacement = r'''function geometryQualityLevel(value: number): number {
  return Math.max(0, Math.min(3, Math.round(Number.isFinite(value) ? value : 1)));
}

function geometryProfile(value: number): { curveSegments: number; bevelSegments: number; faceSegments: number } {
  switch (geometryQualityLevel(value)) {
    case 0: return { curveSegments: 2, bevelSegments: 1, faceSegments: 3 };
    case 2: return { curveSegments: 6, bevelSegments: 2, faceSegments: 8 };
    case 3: return { curveSegments: 10, bevelSegments: 3, faceSegments: 12 };
    default: return { curveSegments: 4, bevelSegments: 1, faceSegments: 6 };
  }
}

function roundedTileGeometry(THREE: any, quality: number): any {
  const width = .43;
  const depth = .57;
  const height = .16;
  const radius = .055;
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -depth / 2;
  const y1 = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0 + radius, y0);
  shape.lineTo(x1 - radius, y0);
  shape.quadraticCurveTo(x1, y0, x1, y0 + radius);
  shape.lineTo(x1, y1 - radius);
  shape.quadraticCurveTo(x1, y1, x1 - radius, y1);
  shape.lineTo(x0 + radius, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - radius);
  shape.lineTo(x0, y0 + radius);
  shape.quadraticCurveTo(x0, y0, x0 + radius, y0);
  const profile = geometryProfile(quality);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    curveSegments: profile.curveSegments,
    bevelEnabled: true,
    bevelSegments: profile.bevelSegments,
    bevelSize: .018,
    bevelThickness: .018,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.center();
  return geometry;
}

function roundedBackShellGeometry(THREE: any, quality: number): any {
  const width = .430;
  const depth = .570;
  const height = .052;
  const radius = .058;
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -depth / 2;
  const y1 = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0 + radius, y0);
  shape.lineTo(x1 - radius, y0);
  shape.quadraticCurveTo(x1, y0, x1, y0 + radius);
  shape.lineTo(x1, y1 - radius);
  shape.quadraticCurveTo(x1, y1, x1 - radius, y1);
  shape.lineTo(x0 + radius, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - radius);
  shape.lineTo(x0, y0 + radius);
  shape.quadraticCurveTo(x0, y0, x0 + radius, y0);
  const profile = geometryProfile(quality);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, steps: 1, curveSegments: profile.curveSegments, bevelEnabled: true,
    bevelSegments: profile.bevelSegments, bevelSize: .009, bevelThickness: .009,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.center();
  return geometry;
}

function roundedFaceGeometry(THREE: any, width: number, depth: number, radius: number, quality: number): any {
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -depth / 2;
  const y1 = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0 + radius, y0);
  shape.lineTo(x1 - radius, y0);
  shape.quadraticCurveTo(x1, y0, x1, y0 + radius);
  shape.lineTo(x1, y1 - radius);
  shape.quadraticCurveTo(x1, y1, x1 - radius, y1);
  shape.lineTo(x0 + radius, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - radius);
  shape.lineTo(x0, y0 + radius);
  shape.quadraticCurveTo(x0, y0, x0 + radius, y0);
  const geometry = new THREE.ShapeGeometry(shape, geometryProfile(quality).faceSegments);
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(index, (positions.getX(index) - x0) / width, (positions.getY(index) - y0) / depth);
  }
  uvs.needsUpdate = true;
  return geometry;
}
'''
table = table[:start] + replacement + table[end:]

# Make face geometry generation use the active runtime quality.
table = table.replace(
    "const geometry = roundedFaceGeometry(rt.THREE, .39, .53, .038);",
    "const geometry = roundedFaceGeometry(rt.THREE, .39, .53, .038, rt.geometryQuality);",
)

# Runtime geometry creation.
table = table.replace(
    "  const tileGeometry = roundedTileGeometry(THREE);\n  const faceGeometry = roundedFaceGeometry(THREE, .39, .53, .038);\n  // Pattern is intentionally inset; the separate 3D shell provides the coloured edge spill.\n  const backGeometry = roundedFaceGeometry(THREE, .405, .545, .043);\n  const backShellGeometry = roundedBackShellGeometry(THREE);",
    "  const geometryQuality = geometryQualityLevel(tuning.graphics.geometryQuality);\n  const tileGeometry = roundedTileGeometry(THREE, geometryQuality);\n  const faceGeometry = roundedFaceGeometry(THREE, .39, .53, .038, geometryQuality);\n  // Pattern is intentionally inset; the separate 3D shell provides the coloured edge spill.\n  const backGeometry = roundedFaceGeometry(THREE, .405, .545, .043, geometryQuality);\n  const backShellGeometry = roundedBackShellGeometry(THREE, geometryQuality);",
    1,
)
table = table.replace(
    "    infoCallsAtSampleStart: 0,\n  };",
    "    infoCallsAtSampleStart: 0,\n    geometryQuality,\n  };",
    1,
)

# Include the quality level in perf telemetry.
table = table.replace(
    "        benchmarkStage: rt.benchmarkStage,\n        pixelRatio: rt.renderer.getPixelRatio(),",
    "        benchmarkStage: rt.benchmarkStage,\n        geometryQuality: rt.geometryQuality,\n        pixelRatio: rt.renderer.getPixelRatio(),",
    1,
)

# Recreate runtime when the geometry level changes; otherwise geometry cannot change live safely.
old_listener = """window.addEventListener('mahjong-live:dev-tuning', (event) => {
  const detail = (event as CustomEvent<DevTuning>).detail;
  devTuningCache = detail && typeof detail === 'object' ? detail : null;
  scheduleReconcile();
});"""
new_listener = """window.addEventListener('mahjong-live:dev-tuning', (event) => {
  const detail = (event as CustomEvent<DevTuning>).detail;
  devTuningCache = detail && typeof detail === 'object' ? detail : null;
  if (runtime && detail?.graphics
    && geometryQualityLevel(detail.graphics.geometryQuality) !== runtime.geometryQuality) {
    disposeRuntime();
    loadError = false;
  }
  scheduleReconcile();
});"""
if old_listener not in table:
    raise SystemExit('dev tuning listener anchor missing')
table = table.replace(old_listener, new_listener, 1)

table_path.write_text(table, encoding='utf-8')

# ---- dev-tuning.ts ----
dev = dev.replace(
    "graphics: { pixelRatio: number; shadowQuality: number; anisotropy: number };",
    "graphics: { pixelRatio: number; shadowQuality: number; anisotropy: number; geometryQuality: number };",
    1,
)
dev = dev.replace(
    "graphics: { pixelRatio: 1.0, shadowQuality: 1, anisotropy: 4 },",
    "graphics: { pixelRatio: 1.0, shadowQuality: 1, anisotropy: 4, geometryQuality: 1 },",
    1,
)
dev = dev.replace(
    "      anisotropy: finite(raw.graphics?.anisotropy, DEFAULTS.graphics.anisotropy),\n",
    "      anisotropy: finite(raw.graphics?.anisotropy, DEFAULTS.graphics.anisotropy),\n      geometryQuality: finite(raw.graphics?.geometryQuality, DEFAULTS.graphics.geometryQuality),\n",
    1,
)
dev = dev.replace(
    "  visibility?: string;\n};",
    "  visibility?: string;\n  geometryQuality?: number;\n};",
    1,
)

# Perf rows/header.
dev = dev.replace(
    "    detail.benchmarkStage ?? '',\n    performanceNumber(detail.pixelRatio),",
    "    detail.benchmarkStage ?? '',\n    String(detail.geometryQuality ?? ''),\n    performanceNumber(detail.pixelRatio),",
    1,
)
dev = dev.replace(
    "      `graphicsSettings\\tpixelRatio=${settings.graphics.pixelRatio}\\tshadowQuality=${settings.graphics.shadowQuality}\\tanisotropy=${settings.graphics.anisotropy}`,",
    "      `graphicsSettings\\tpixelRatio=${settings.graphics.pixelRatio}\\tshadowQuality=${settings.graphics.shadowQuality}\\tanisotropy=${settings.graphics.anisotropy}\\tgeometryQuality=${settings.graphics.geometryQuality}`,",
    1,
)
dev = dev.replace(
    "renderer_backend\\tbenchmark_stage\\tpixel_ratio',",
    "renderer_backend\\tbenchmark_stage\\tgeometry_quality\\tpixel_ratio',",
    1,
)

# Slider right next to the main graphics controls.
anchor = "  numberSlider(graphics, 'Texture filtering', 1, 8, 1, () => settings.graphics.anisotropy, (v) => { settings.graphics.anisotropy = v; }, '×', DEFAULTS.graphics.anisotropy);\n"
insert = anchor + "  numberSlider(graphics, 'Tile corner quality', 0, 3, 1, () => settings.graphics.geometryQuality, (v) => { settings.graphics.geometryQuality = Math.round(v); }, '', DEFAULTS.graphics.geometryQuality);\n"
if anchor not in dev:
    raise SystemExit('graphics slider anchor missing')
dev = dev.replace(anchor, insert, 1)

# Explain levels and that changing them rebuilds the 3D runtime.
old_note = "Printed tile art shares one atlas texture/material. On Chromium/Edge with WebGPU available, WebGPU is now the automatic default unless you explicitly choose another backend; Firefox stays on WebGL 2 because its current Three.js WebGPU path can hang the tab. WebGPU keeps a 4 s initialization timeout and automatic WebGL fallback. Performance TXT is rate-limited to one clean sample per interval and renderer.info is reset per frame on both backends."
new_note = "Printed tile art shares one atlas texture/material. Tile corner quality: 0 = Low (2/1), 1 = Medium/current (4/1), 2 = High (6/2), 3 = Ultra (10/3); changing it rebuilds the 3D runtime so the difference is real geometry, not CSS. On Chromium/Edge with WebGPU available, WebGPU is the automatic default unless explicitly overridden; Firefox stays on WebGL 2 because its current Three.js WebGPU path can hang the tab."
if old_note not in dev:
    raise SystemExit('graphics note anchor missing')
dev = dev.replace(old_note, new_note, 1)

dev_path.write_text(dev, encoding='utf-8')
