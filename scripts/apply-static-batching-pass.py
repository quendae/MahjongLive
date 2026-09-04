from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
text = table_path.read_text(encoding='utf-8')

repls = []
repls.append((
"""  staticRiverBodies: any;\n  staticRiverShells: any;\n  staticRiverCapacity: number;\n""",
"""  staticRiverBodies: any;\n  staticRiverShells: any;\n  staticBacks: any;\n  staticRiverCapacity: number;\n"""))
repls.append((
"""  renderer.shadowMap.enabled = tuning.graphics.shadowQuality > 0;\n  renderer.shadowMap.type = THREE.PCFSoftShadowMap;\n""",
"""  renderer.shadowMap.enabled = tuning.graphics.shadowQuality > 0;\n  renderer.shadowMap.type = THREE.PCFSoftShadowMap;\n  // Most of the table is static between actions. Re-rendering the complete shadow map on every\n  // browser frame costs one extra draw for every tile. Cache it and invalidate only when actors move\n  // or tuning/table geometry changes.\n  renderer.shadowMap.autoUpdate = false;\n  renderer.shadowMap.needsUpdate = tuning.graphics.shadowQuality > 0;\n"""))
repls.append((
"""  // Static discards are the population that grows throughout a round. Keep their unique SVG\n  // fronts as normal meshes, but batch the shared ivory bodies and coloured rear shells into two\n  // draw calls instead of two extra draw calls per discard.\n  const staticRiverCapacity = 192;\n""",
"""  // Batch shared geometry for every settled, non-selectable tile, not only river tiles. This is\n  // especially important at the start of a hand where three concealed opponent racks otherwise\n  // account for well over a hundred separate body/shell/back draws before anyone has discarded.\n  const staticRiverCapacity = 256;\n"""))
repls.append((
"""  actorRoot.add(staticRiverShells);\n\n  const gl = renderer.getContext();\n""",
"""  actorRoot.add(staticRiverShells);\n  const staticBacks = new THREE.InstancedMesh(backGeometry, backMaterial, staticRiverCapacity);\n  staticBacks.count = 0;\n  staticBacks.castShadow = false;\n  staticBacks.receiveShadow = false;\n  staticBacks.frustumCulled = false;\n  staticBacks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);\n  actorRoot.add(staticBacks);\n\n  const gl = renderer.getContext();\n"""))
repls.append((
"""    staticRiverBodies,\n    staticRiverShells,\n    staticRiverCapacity,\n""",
"""    staticRiverBodies,\n    staticRiverShells,\n    staticBacks,\n    staticRiverCapacity,\n"""))
repls.append((
"""function syncStaticRiverInstances(rt: TableRuntime): void {\n  if (!rt.staticRiverDirty) return;\n  rt.staticRiverDirty = false;\n  const THREE = rt.THREE;\n  const bodyMatrix = new THREE.Matrix4();\n  const shellMatrix = new THREE.Matrix4();\n  const shellLocal = new THREE.Matrix4().makeTranslation(0, -.103, 0);\n  let count = 0;\n\n  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n    const canBatch = actor.spec.zone === 'river' && !actor.motion && count < rt.staticRiverCapacity;\n    actor.body.visible = !canBatch;\n    actor.rearShell.visible = !canBatch;\n    if (!canBatch) continue;\n\n    actor.group.updateMatrix();\n    actor.visual.updateMatrix();\n    bodyMatrix.multiplyMatrices(actor.group.matrix, actor.visual.matrix);\n    rt.staticRiverBodies.setMatrixAt(count, bodyMatrix);\n    shellMatrix.multiplyMatrices(bodyMatrix, shellLocal);\n    rt.staticRiverShells.setMatrixAt(count, shellMatrix);\n    count += 1;\n  }\n\n  rt.staticRiverCount = count;\n  rt.staticRiverBodies.count = count;\n  rt.staticRiverShells.count = count;\n  rt.staticRiverBodies.instanceMatrix.needsUpdate = true;\n  rt.staticRiverShells.instanceMatrix.needsUpdate = true;\n}\n""",
"""function syncStaticRiverInstances(rt: TableRuntime): void {\n  if (!rt.staticRiverDirty) return;\n  rt.staticRiverDirty = false;\n  const THREE = rt.THREE;\n  const bodyMatrix = new THREE.Matrix4();\n  const shellMatrix = new THREE.Matrix4();\n  const rearMatrix = new THREE.Matrix4();\n  const shellLocal = new THREE.Matrix4().makeTranslation(0, -.103, 0);\n  const rearPosition = new THREE.Matrix4().makeTranslation(0, -TILE_BACK_OFFSET, 0);\n  const rearRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);\n  const rearLocal = new THREE.Matrix4().multiplyMatrices(rearPosition, rearRotation);\n  let count = 0;\n  let backCount = 0;\n\n  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n    // Keep selectable tiles individual so hover/click motion remains exact. Everything else can be\n    // instanced as soon as it has settled, including opponent racks, melds and rivers.\n    const canBatch = !actor.motion && !actor.spec.selectable && count < rt.staticRiverCapacity;\n    actor.body.visible = !canBatch;\n    actor.rearShell.visible = !canBatch;\n    actor.rear.visible = actor.spec.back && !canBatch;\n    if (!canBatch) continue;\n\n    actor.group.updateMatrix();\n    actor.visual.updateMatrix();\n    bodyMatrix.multiplyMatrices(actor.group.matrix, actor.visual.matrix);\n    rt.staticRiverBodies.setMatrixAt(count, bodyMatrix);\n    shellMatrix.multiplyMatrices(bodyMatrix, shellLocal);\n    rt.staticRiverShells.setMatrixAt(count, shellMatrix);\n    if (actor.spec.back && backCount < rt.staticRiverCapacity) {\n      rearMatrix.multiplyMatrices(bodyMatrix, rearLocal);\n      rt.staticBacks.setMatrixAt(backCount, rearMatrix);\n      backCount += 1;\n    }\n    count += 1;\n  }\n\n  rt.staticRiverCount = count;\n  rt.staticRiverBodies.count = count;\n  rt.staticRiverShells.count = count;\n  rt.staticBacks.count = backCount;\n  rt.staticRiverBodies.instanceMatrix.needsUpdate = true;\n  rt.staticRiverShells.instanceMatrix.needsUpdate = true;\n  rt.staticBacks.instanceMatrix.needsUpdate = true;\n  if (rt.renderer.shadowMap.enabled) rt.renderer.shadowMap.needsUpdate = true;\n}\n"""))
repls.append((
"""  rt.staticRiverDirty = true;\n  syncStaticRiverInstances(rt);\n  rt.lastRemainingDraws = draws;\n""",
"""  rt.staticRiverDirty = true;\n  syncStaticRiverInstances(rt);\n  if (rt.renderer.shadowMap.enabled) rt.renderer.shadowMap.needsUpdate = true;\n  rt.lastRemainingDraws = draws;\n"""))
repls.append((
"""  rt.renderer.shadowMap.enabled = shadowSize > 0;\n  rt.keyLight.castShadow = shadowSize > 0;\n""",
"""  rt.renderer.shadowMap.enabled = shadowSize > 0;\n  rt.renderer.shadowMap.autoUpdate = false;\n  rt.keyLight.castShadow = shadowSize > 0;\n"""))
repls.append((
"""  syncTableTexture(rt, tuning.tableImage);\n  syncWorldUiAnchor(rt);\n}\n""",
"""  syncTableTexture(rt, tuning.tableImage);\n  syncWorldUiAnchor(rt);\n  if (shadowSize > 0) rt.renderer.shadowMap.needsUpdate = true;\n}\n"""))
repls.append((
"""  if (rt.staticRiverDirty) syncStaticRiverInstances(rt);\n\n  const renderStarted = performance.now();\n""",
"""  if (rt.staticRiverDirty) syncStaticRiverInstances(rt);\n  // During motion the cached shadow map must follow the moving tile. Once motion ends it freezes\n  // again, avoiding dozens/hundreds of shadow-pass draw calls on every otherwise static frame.\n  if (movingCount > 0 && rt.renderer.shadowMap.enabled) rt.renderer.shadowMap.needsUpdate = true;\n\n  const renderStarted = performance.now();\n"""))
repls.append((
"""  rt.backShellMaterial.dispose();\n  rt.tableTexture?.dispose?.();\n""",
"""  rt.backShellMaterial.dispose();\n  rt.staticRiverBodies.dispose?.();\n  rt.staticRiverShells.dispose?.();\n  rt.staticBacks.dispose?.();\n  rt.tableTexture?.dispose?.();\n"""))

for old, new in repls:
    if old not in text:
        raise SystemExit('Missing table-3d pattern:\n' + old[:240])
    text = text.replace(old, new, 1)

table_path.write_text(text, encoding='utf-8')

# Make the diagnostics accurately describe the broadened batching.
dev = dev_path.read_text(encoding='utf-8')
dev = dev.replace('batched_river_tiles\\tpixel_ratio', 'batched_static_tiles\\tpixel_ratio')
dev = dev.replace('batched river ·', 'batched static ·')
dev = dev.replace('Static discard bodies/rear shells are instanced so river growth adds far fewer draw calls.', 'Settled non-selectable tile bodies/shells/backs are instanced, and shadow maps are cached between movements, so both the opening racks and full rivers require far fewer draw calls.')
dev_path.write_text(dev, encoding='utf-8')
