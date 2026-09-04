from pathlib import Path

root = Path(__file__).resolve().parents[1]
table_path = root / 'client/src/table-3d.ts'
dev_path = root / 'client/src/dev-tuning.ts'
text = table_path.read_text(encoding='utf-8')

repls = []
repls.append((
"""  staticBacks: any;\n  staticRiverCapacity: number;\n  staticRiverCount: number;\n  staticRiverDirty: boolean;\n""",
"""  staticBacks: any;\n  staticFaceBatches: Map<string, any>;\n  staticFaceBatchCapacity: number;\n  staticFaceCount: number;\n  staticRiverCapacity: number;\n  staticRiverCount: number;\n  staticRiverDirty: boolean;\n"""))

repls.append((
"""  // Printed artwork does not need a PBR shader. Lambert keeps the same scene lighting while\n  // making the many unique SVG face materials substantially cheaper to render.\n  const material = new rt.THREE.MeshLambertMaterial({\n""",
"""  // The porcelain body provides the physical lighting/shading. The printed SVG plane itself is\n  // effectively ink on that surface, so an unlit shader is both visually stable and far cheaper\n  // than evaluating a light for every visible tile face.\n  const material = new rt.THREE.MeshBasicMaterial({\n"""))

repls.append((
"""function syncFaceMode(rt: TableRuntime): void {\n  const next = readFaceMode();\n  if (next === rt.faceMode) return;\n  rt.faceMode = next;\n  disposeFaceMaterials(rt);\n""",
"""function clearStaticFaceBatches(rt: TableRuntime): void {\n  for (const batch of rt.staticFaceBatches.values()) batch.removeFromParent();\n  rt.staticFaceBatches.clear();\n  rt.staticFaceCount = 0;\n}\n\nfunction staticFaceBatchKey(rt: TableRuntime, label: string | null): string {\n  return `${rt.faceMode}:${label ?? 'blank'}`;\n}\n\nfunction ensureStaticFaceBatch(rt: TableRuntime, label: string | null): any {\n  const key = staticFaceBatchKey(rt, label);\n  const existing = rt.staticFaceBatches.get(key);\n  if (existing) return existing;\n  const batch = new rt.THREE.InstancedMesh(\n    rt.faceGeometry,\n    materialForFace(rt, label, false),\n    rt.staticFaceBatchCapacity,\n  );\n  batch.count = 0;\n  batch.castShadow = false;\n  batch.receiveShadow = false;\n  batch.frustumCulled = false;\n  batch.renderOrder = 4;\n  batch.instanceMatrix.setUsage(rt.THREE.DynamicDrawUsage);\n  rt.actorRoot.add(batch);\n  rt.staticFaceBatches.set(key, batch);\n  return batch;\n}\n\nfunction syncFaceMode(rt: TableRuntime): void {\n  const next = readFaceMode();\n  if (next === rt.faceMode) return;\n  rt.faceMode = next;\n  clearStaticFaceBatches(rt);\n  disposeFaceMaterials(rt);\n"""))

repls.append((
"""  const staticBacks = new THREE.InstancedMesh(backGeometry, backMaterial, staticRiverCapacity);\n  staticBacks.count = 0;\n  staticBacks.castShadow = false;\n  staticBacks.receiveShadow = false;\n  staticBacks.frustumCulled = false;\n  staticBacks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);\n  actorRoot.add(staticBacks);\n\n  const gl = renderer.getContext();\n""",
"""  const staticBacks = new THREE.InstancedMesh(backGeometry, backMaterial, staticRiverCapacity);\n  staticBacks.count = 0;\n  staticBacks.castShadow = false;\n  staticBacks.receiveShadow = false;\n  staticBacks.frustumCulled = false;\n  staticBacks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);\n  actorRoot.add(staticBacks);\n  // Face-up static tiles are grouped by artwork/material. A full river can therefore render 96\n  // printed faces in roughly one draw per distinct tile design instead of one draw per tile.\n  const staticFaceBatches = new Map<string, any>();\n  const staticFaceBatchCapacity = 32;\n\n  const gl = renderer.getContext();\n"""))

repls.append((
"""    staticRiverBodies,\n    staticRiverShells,\n    staticBacks,\n    staticRiverCapacity,\n    staticRiverCount: 0,\n""",
"""    staticRiverBodies,\n    staticRiverShells,\n    staticBacks,\n    staticFaceBatches,\n    staticFaceBatchCapacity,\n    staticFaceCount: 0,\n    staticRiverCapacity,\n    staticRiverCount: 0,\n"""))

old_sync = """function syncStaticRiverInstances(rt: TableRuntime): void {\n  if (!rt.staticRiverDirty) return;\n  rt.staticRiverDirty = false;\n  const THREE = rt.THREE;\n  const bodyMatrix = new THREE.Matrix4();\n  const shellMatrix = new THREE.Matrix4();\n  const rearMatrix = new THREE.Matrix4();\n  const shellLocal = new THREE.Matrix4().makeTranslation(0, -.103, 0);\n  const rearPosition = new THREE.Matrix4().makeTranslation(0, -TILE_BACK_OFFSET, 0);\n  const rearRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);\n  const rearLocal = new THREE.Matrix4().multiplyMatrices(rearPosition, rearRotation);\n  let count = 0;\n  let backCount = 0;\n\n  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n    // Keep selectable tiles individual so hover/click motion remains exact. Everything else can be\n    // instanced as soon as it has settled, including opponent racks, melds and rivers.\n    const canBatch = !actor.motion && !actor.spec.selectable && count < rt.staticRiverCapacity;\n    actor.body.visible = !canBatch;\n    actor.rearShell.visible = !canBatch;\n    actor.rear.visible = actor.spec.back && !canBatch;\n    if (!canBatch) continue;\n\n    actor.group.updateMatrix();\n    actor.visual.updateMatrix();\n    bodyMatrix.multiplyMatrices(actor.group.matrix, actor.visual.matrix);\n    rt.staticRiverBodies.setMatrixAt(count, bodyMatrix);\n    shellMatrix.multiplyMatrices(bodyMatrix, shellLocal);\n    rt.staticRiverShells.setMatrixAt(count, shellMatrix);\n    if (actor.spec.back && backCount < rt.staticRiverCapacity) {\n      rearMatrix.multiplyMatrices(bodyMatrix, rearLocal);\n      rt.staticBacks.setMatrixAt(backCount, rearMatrix);\n      backCount += 1;\n    }\n    count += 1;\n  }\n\n  rt.staticRiverCount = count;\n  rt.staticRiverBodies.count = count;\n  rt.staticRiverShells.count = count;\n  rt.staticBacks.count = backCount;\n  rt.staticRiverBodies.instanceMatrix.needsUpdate = true;\n  rt.staticRiverShells.instanceMatrix.needsUpdate = true;\n  rt.staticBacks.instanceMatrix.needsUpdate = true;\n  if (rt.renderer.shadowMap.enabled) rt.renderer.shadowMap.needsUpdate = true;\n}\n"""
new_sync = """function syncStaticRiverInstances(rt: TableRuntime): void {\n  if (!rt.staticRiverDirty) return;\n  rt.staticRiverDirty = false;\n  const THREE = rt.THREE;\n  const bodyMatrix = new THREE.Matrix4();\n  const shellMatrix = new THREE.Matrix4();\n  const rearMatrix = new THREE.Matrix4();\n  const faceMatrix = new THREE.Matrix4();\n  const shellLocal = new THREE.Matrix4().makeTranslation(0, -.103, 0);\n  const rearPosition = new THREE.Matrix4().makeTranslation(0, -TILE_BACK_OFFSET, 0);\n  const rearRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);\n  const rearLocal = new THREE.Matrix4().multiplyMatrices(rearPosition, rearRotation);\n  const faceCounts = new Map<string, number>();\n  for (const batch of rt.staticFaceBatches.values()) batch.count = 0;\n  let count = 0;\n  let backCount = 0;\n  let faceCount = 0;\n\n  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n    // Keep selectable tiles individual so hover/click motion remains exact. Everything else can be\n    // instanced as soon as it has settled, including opponent racks, melds and rivers.\n    const canBatch = !actor.motion && !actor.spec.selectable && count < rt.staticRiverCapacity;\n    actor.body.visible = !canBatch;\n    actor.rearShell.visible = !canBatch;\n    actor.rear.visible = actor.spec.back && !canBatch;\n    actor.face.visible = !actor.spec.back && !canBatch;\n    if (!canBatch) continue;\n\n    actor.group.updateMatrix();\n    actor.visual.updateMatrix();\n    bodyMatrix.multiplyMatrices(actor.group.matrix, actor.visual.matrix);\n    rt.staticRiverBodies.setMatrixAt(count, bodyMatrix);\n    shellMatrix.multiplyMatrices(bodyMatrix, shellLocal);\n    rt.staticRiverShells.setMatrixAt(count, shellMatrix);\n    if (actor.spec.back && backCount < rt.staticRiverCapacity) {\n      rearMatrix.multiplyMatrices(bodyMatrix, rearLocal);\n      rt.staticBacks.setMatrixAt(backCount, rearMatrix);\n      backCount += 1;\n    } else if (!actor.spec.back) {\n      const key = staticFaceBatchKey(rt, actor.spec.label);\n      const index = faceCounts.get(key) ?? 0;\n      if (index < rt.staticFaceBatchCapacity) {\n        const batch = ensureStaticFaceBatch(rt, actor.spec.label);\n        actor.face.updateMatrix();\n        faceMatrix.multiplyMatrices(bodyMatrix, actor.face.matrix);\n        batch.setMatrixAt(index, faceMatrix);\n        faceCounts.set(key, index + 1);\n        faceCount += 1;\n      } else {\n        // Extremely artificial duplicate-heavy stress layouts can exceed a per-design batch. Keep\n        // the overflow face individual without giving up body/shell batching.\n        actor.face.visible = true;\n      }\n    }\n    count += 1;\n  }\n\n  rt.staticRiverCount = count;\n  rt.staticFaceCount = faceCount;\n  rt.staticRiverBodies.count = count;\n  rt.staticRiverShells.count = count;\n  rt.staticBacks.count = backCount;\n  rt.staticRiverBodies.instanceMatrix.needsUpdate = true;\n  rt.staticRiverShells.instanceMatrix.needsUpdate = true;\n  rt.staticBacks.instanceMatrix.needsUpdate = true;\n  for (const [key, batch] of rt.staticFaceBatches) {\n    const batchCount = faceCounts.get(key) ?? 0;\n    batch.count = batchCount;\n    if (batchCount > 0) batch.instanceMatrix.needsUpdate = true;\n  }\n  if (rt.renderer.shadowMap.enabled) rt.renderer.shadowMap.needsUpdate = true;\n}\n"""
repls.append((old_sync, new_sync))

repls.append((
"""        instancedRivers: rt.staticRiverCount,\n        pixelRatio: rt.renderer.getPixelRatio(),\n""",
"""        instancedRivers: rt.staticRiverCount,\n        batchedFaces: rt.staticFaceCount,\n        faceBatches: [...rt.staticFaceBatches.values()].filter((batch) => batch.count > 0).length,\n        pixelRatio: rt.renderer.getPixelRatio(),\n"""))

repls.append((
"""  rt.staticRiverBodies.dispose?.();\n  rt.staticRiverShells.dispose?.();\n  rt.staticBacks.dispose?.();\n  rt.tableTexture?.dispose?.();\n""",
"""  rt.staticRiverBodies.dispose?.();\n  rt.staticRiverShells.dispose?.();\n  rt.staticBacks.dispose?.();\n  clearStaticFaceBatches(rt);\n  rt.tableTexture?.dispose?.();\n"""))

for old, new in repls:
    if old not in text:
        raise SystemExit('Missing table-3d pattern:\n' + old[:300])
    text = text.replace(old, new, 1)

table_path.write_text(text, encoding='utf-8')

# Extend diagnostics so the next log proves how many printed fronts were consolidated.
dev = dev_path.read_text(encoding='utf-8')
dev = dev.replace(
"""  instancedRivers?: number;\n  pixelRatio?: number;\n""",
"""  instancedRivers?: number;\n  batchedFaces?: number;\n  faceBatches?: number;\n  pixelRatio?: number;\n""", 1)
dev = dev.replace(
"""    String(detail.instancedRivers ?? ''),\n    performanceNumber(detail.pixelRatio),\n""",
"""    String(detail.instancedRivers ?? ''),\n    String(detail.batchedFaces ?? ''),\n    String(detail.faceBatches ?? ''),\n    performanceNumber(detail.pixelRatio),\n""", 1)
dev = dev.replace(
"""batched_static_tiles\\tpixel_ratio""",
"""batched_static_tiles\\tbatched_face_tiles\\tface_batches\\tpixel_ratio""", 1)
dev = dev.replace(
"""${detail.moving ?? 0} moving · ${detail.instancedRivers ?? 0} batched static · ${(detail.pixelRatio ?? 1).toFixed(2)}× pixel ratio""",
"""${detail.moving ?? 0} moving · ${detail.instancedRivers ?? 0} batched static · ${detail.batchedFaces ?? 0} batched faces in ${detail.faceBatches ?? 0} face draws · ${(detail.pixelRatio ?? 1).toFixed(2)}× pixel ratio""", 1)
dev = dev.replace(
"""Settled non-selectable tile bodies/shells/backs are instanced, and shadow maps are cached between movements, so both the opening racks and full rivers require far fewer draw calls.""",
"""Settled non-selectable bodies/shells/backs are instanced, printed fronts are additionally instanced by tile design, and shadow maps are cached between movements. The stress test should now expose whether remaining cost is geometry/driver rather than per-tile draw calls.""", 1)
dev_path.write_text(dev, encoding='utf-8')
