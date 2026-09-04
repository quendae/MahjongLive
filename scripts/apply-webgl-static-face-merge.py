from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'client/src/table-3d.ts'
text = path.read_text(encoding='utf-8')

start = text.index('function clearStaticFaceBatches(rt: TableRuntime): void {')
end = text.index('\nfunction syncFaceMode(rt: TableRuntime): void {', start)
replacement = r'''function clearStaticFaceBatches(rt: TableRuntime): void {
  for (const batch of rt.staticFaceBatches.values()) {
    batch.removeFromParent();
    if (batch.userData?.mergedStaticFaces) batch.geometry?.dispose?.();
    batch.dispose?.();
  }
  rt.staticFaceBatches.clear();
  rt.staticFaceCount = 0;
}

type StaticFaceMergeEntry = { actor: TileActor; matrix: any };

function rebuildMergedStaticFaceBatch(rt: TableRuntime, entries: StaticFaceMergeEntry[]): void {
  clearStaticFaceBatches(rt);
  if (entries.length === 0) return;

  const THREE = rt.THREE;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  for (const entry of entries) {
    const geometry = entry.actor.face.geometry;
    const positionAttr = geometry.getAttribute('position');
    const normalAttr = geometry.getAttribute('normal');
    const uvAttr = geometry.getAttribute('uv');
    const indexAttr = geometry.index;
    normalMatrix.getNormalMatrix(entry.matrix);

    const pushVertex = (sourceIndex: number) => {
      vertex.fromBufferAttribute(positionAttr, sourceIndex).applyMatrix4(entry.matrix);
      positions.push(vertex.x, vertex.y, vertex.z);
      if (normalAttr) {
        normal.fromBufferAttribute(normalAttr, sourceIndex).applyNormalMatrix(normalMatrix);
      } else {
        normal.set(0, 0, 1).applyNormalMatrix(normalMatrix);
      }
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(uvAttr.getX(sourceIndex), uvAttr.getY(sourceIndex));
    };

    if (indexAttr) {
      for (let index = 0; index < indexAttr.count; index += 1) pushVertex(indexAttr.getX(index));
    } else {
      for (let index = 0; index < positionAttr.count; index += 1) pushVertex(index);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  const mesh = new THREE.Mesh(geometry, rt.faceAtlasMaterial);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.userData.mergedStaticFaces = true;
  mesh.userData.faceCount = entries.length;
  // Keep the existing diagnostics compatible: one merged face batch is one draw group.
  mesh.count = entries.length;
  rt.actorRoot.add(mesh);
  rt.staticFaceBatches.set('merged-atlas-faces', mesh);
  rt.staticFaceCount = entries.length;
}
'''
text = text[:start] + replacement + text[end:]

start = text.index('function syncStaticRiverInstances(rt: TableRuntime): void {')
end = text.index('\nconst STRESS_TILE_LABELS = [', start)
replacement = r'''function syncStaticRiverInstances(rt: TableRuntime): void {
  if (!rt.staticRiverDirty) return;
  rt.staticRiverDirty = false;
  const THREE = rt.THREE;
  const bodyMatrix = new THREE.Matrix4();
  const shellMatrix = new THREE.Matrix4();
  const rearMatrix = new THREE.Matrix4();
  const faceMatrix = new THREE.Matrix4();
  const shellLocal = new THREE.Matrix4().makeTranslation(0, -.103, 0);
  const rearPosition = new THREE.Matrix4().makeTranslation(0, -TILE_BACK_OFFSET, 0);
  const rearRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const rearLocal = new THREE.Matrix4().multiplyMatrices(rearPosition, rearRotation);
  const mergedFaces: StaticFaceMergeEntry[] = [];
  let count = 0;
  let backCount = 0;

  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {
    // Keep selectable tiles individual so hover/click motion remains exact. Everything else can be
    // instanced as soon as it has settled, including opponent racks, melds and rivers.
    const canBatch = !actor.motion && !actor.spec.selectable && count < rt.staticRiverCapacity;
    actor.body.visible = !canBatch;
    actor.rearShell.visible = !canBatch;
    actor.rear.visible = actor.spec.back && !canBatch;
    actor.face.visible = !actor.spec.back && !canBatch;
    if (!canBatch) continue;

    actor.group.updateMatrix();
    actor.visual.updateMatrix();
    bodyMatrix.multiplyMatrices(actor.group.matrix, actor.visual.matrix);
    rt.staticRiverBodies.setMatrixAt(count, bodyMatrix);
    shellMatrix.multiplyMatrices(bodyMatrix, shellLocal);
    rt.staticRiverShells.setMatrixAt(count, shellMatrix);
    if (actor.spec.back && backCount < rt.staticRiverCapacity) {
      rearMatrix.multiplyMatrices(bodyMatrix, rearLocal);
      rt.staticBacks.setMatrixAt(backCount, rearMatrix);
      backCount += 1;
    } else if (!actor.spec.back) {
      actor.face.updateMatrix();
      faceMatrix.multiplyMatrices(bodyMatrix, actor.face.matrix);
      // All printed art already lives in one atlas and shares one material. Merge settled faces into
      // one non-indexed mesh so WebGL submits a single static face draw instead of one draw per tile design.
      mergedFaces.push({ actor, matrix: faceMatrix.clone() });
    }
    count += 1;
  }

  rt.staticRiverCount = count;
  rt.staticRiverBodies.count = count;
  rt.staticRiverShells.count = count;
  rt.staticBacks.count = backCount;
  rt.staticRiverBodies.instanceMatrix.needsUpdate = true;
  rt.staticRiverShells.instanceMatrix.needsUpdate = true;
  rt.staticBacks.instanceMatrix.needsUpdate = true;
  rebuildMergedStaticFaceBatch(rt, mergedFaces);
  applyBenchmarkVisibility(rt);
  if (rt.renderer.shadowMap?.enabled) rt.renderer.shadowMap.needsUpdate = true;
}
'''
text = text[:start] + replacement + text[end:]

# Add a sample baseline for WebGPU's cumulative renderer.info.calls counter.
old = '''  benchmarkStage: BenchmarkStage;\n};'''
new = '''  benchmarkStage: BenchmarkStage;\n  infoCallsAtSampleStart: number;\n};'''
if old not in text:
    raise SystemExit('runtime type anchor missing')
text = text.replace(old, new, 1)

old = '''    rendererBackend: wantsWebGpu ? 'webgpu' : 'webgl',\n    benchmarkStage: 'normal',\n  };'''
new = '''    rendererBackend: wantsWebGpu ? 'webgpu' : 'webgl',\n    benchmarkStage: 'normal',\n    infoCallsAtSampleStart: 0,\n  };'''
if old not in text:
    raise SystemExit('runtime initializer anchor missing')
text = text.replace(old, new, 1)

old = '''      window.dispatchEvent(new CustomEvent('mahjong-live:fps', { detail: {\n        fps: loopHz,'''
new = '''      const rawCalls = rt.renderer.info?.render?.calls ?? 0;\n      const calls = rt.rendererBackend === 'webgpu'\n        ? Math.max(0, (rawCalls - rt.infoCallsAtSampleStart) / Math.max(1, rt.fpsFrames))\n        : rawCalls;\n      rt.infoCallsAtSampleStart = rawCalls;\n      window.dispatchEvent(new CustomEvent('mahjong-live:fps', { detail: {\n        fps: loopHz,'''
if old not in text:
    raise SystemExit('fps event anchor missing')
text = text.replace(old, new, 1)

old = '''        calls: rt.renderer.info?.render?.calls ?? 0,'''
new = '''        calls: Math.round(calls * 10) / 10,'''
if old not in text:
    raise SystemExit('calls detail anchor missing')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
