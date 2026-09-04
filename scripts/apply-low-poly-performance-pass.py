from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
text = table_path.read_text(encoding='utf-8')

# Restore the lit look of printed fronts; MeshBasic made the artwork read like a bright sticker.
old_material = """  // The porcelain body provides the physical lighting/shading. The printed SVG plane itself is\n  // effectively ink on that surface, so an unlit shader is both visually stable and far cheaper\n  // than evaluating a light for every visible tile face.\n  const material = new rt.THREE.MeshBasicMaterial({\n"""
new_material = """  // Keep the SVG artwork participating in the same soft scene lighting as the tile body.\n  // Face batching handles the draw-call cost, so we can keep Lambert here without the bright\n  // sticker-like look of MeshBasicMaterial.\n  const material = new rt.THREE.MeshLambertMaterial({\n"""
if old_material not in text:
    raise SystemExit('Expected MeshBasic front material block not found')
text = text.replace(old_material, new_material, 1)

# The latest profiling shows draw calls are already low while triangle count still scales almost
# linearly with tile count. The rounded ExtrudeGeometry was far denser than needed at table scale.
# Keep the silhouette rounded, but drastically reduce tessellation.
replacements = [
    ('curveSegments: 10,', 'curveSegments: 4,'),
    ('bevelSegments: 4,', 'bevelSegments: 1,'),
    ('new THREE.ShapeGeometry(shape, 14)', 'new THREE.ShapeGeometry(shape, 6)'),
    ('new THREE.RingGeometry(.235, .285, 34)', 'new THREE.RingGeometry(.235, .285, 20)'),
    ('new THREE.RingGeometry(.29, .35, 40)', 'new THREE.RingGeometry(.29, .35, 24)'),
]
changed = {}
for old, new in replacements:
    count = text.count(old)
    changed[old] = count
    if count:
        text = text.replace(old, new)

if changed['curveSegments: 10,'] < 1:
    raise SystemExit('No curveSegments: 10 geometry settings found')
if changed['bevelSegments: 4,'] < 1:
    raise SystemExit('No bevelSegments: 4 geometry settings found')
if changed['new THREE.ShapeGeometry(shape, 14)'] < 1:
    raise SystemExit('No rounded ShapeGeometry(..., 14) found')

table_path.write_text(text, encoding='utf-8')

# Update the dev note so the performance controls describe the current bottleneck accurately.
dev = dev_path.read_text(encoding='utf-8')
needle = 'Settled non-selectable bodies/shells/backs are instanced, printed fronts are additionally instanced by tile design, and shadow maps are cached between movements. The stress test should now expose whether remaining cost is geometry/driver rather than per-tile draw calls.'
replacement = 'Settled non-selectable bodies/shells/backs and printed fronts are instanced, shadow maps are cached, and tile meshes now use much lighter rounded geometry. Watch the triangle count in the log: this pass targets the remaining vertex/geometry cost rather than raster resolution.'
if needle in dev:
    dev = dev.replace(needle, replacement, 1)
dev_path.write_text(dev, encoding='utf-8')

print('Applied geometry reductions:')
for key, value in changed.items():
    print(f'  {key!r}: {value}')
