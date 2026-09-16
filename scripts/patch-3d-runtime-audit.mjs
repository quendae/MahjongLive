import { readFile, writeFile } from 'node:fs/promises';

const path = 'client/src/table-3d.ts';
let source = await readFile(path, 'utf8');

if (source.includes("mahjong-live:3d-audit-request") && source.includes('shadowRefreshSerial: number;')) {
  console.log('3D audit/runtime patch already applied.');
  process.exit(0);
}

function replaceExact(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceExact(
  `  textureAnisotropy: number;\n};`,
  `  textureAnisotropy: number;\n  shadowRefreshSerial: number;\n};`,
  'runtime type shadow serial',
);

replaceExact(
  `    textureAnisotropy: Math.min(tuning.graphics.anisotropy, renderer.capabilities?.getMaxAnisotropy?.() ?? 1),\n  };`,
  `    textureAnisotropy: Math.min(tuning.graphics.anisotropy, renderer.capabilities?.getMaxAnisotropy?.() ?? 1),\n    shadowRefreshSerial: 0,\n  };`,
  'runtime shadow serial init',
);

replaceExact(
  `function rendererBackendLabel(rt: TableRuntime): string {\n  if (rt.rendererBackend === 'webgl') return 'webgl';\n  if (rt.renderer.backend?.isWebGPUBackend) return 'webgpu';\n  if (rt.renderer.backend?.isWebGLBackend) return 'webgpu-renderer/webgl2-fallback';\n  return 'webgpu-renderer';\n}\n`,
  `function rendererBackendLabel(rt: TableRuntime): string {\n  if (rt.rendererBackend === 'webgl') return 'webgl';\n  if (rt.renderer.backend?.isWebGPUBackend) return 'webgpu';\n  if (rt.renderer.backend?.isWebGLBackend) return 'webgpu-renderer/webgl2-fallback';\n  return 'webgpu-renderer';\n}\n\nfunction auditTransform(transform: Transform): Transform {\n  return { ...transform };\n}\n\nfunction auditVector(vector: any): { x: number; y: number; z: number } {\n  return { x: vector.x, y: vector.y, z: vector.z };\n}\n\nfunction auditSnapshot(rt: TableRuntime): Record<string, unknown> {\n  rt.scene.updateMatrixWorld(true);\n  const rect = rt.table?.getBoundingClientRect() ?? null;\n  const actors = [...rt.actors.values()].map((actor) => {\n    const visualWorldOffset = new rt.THREE.Vector3()\n      .copy(actor.visual.position)\n      .applyQuaternion(actor.group.quaternion);\n    const screenPoint = new rt.THREE.Vector3();\n    actor.body.getWorldPosition(screenPoint);\n    screenPoint.project(rt.camera);\n    const screen = rect ? {\n      x: rect.left + (screenPoint.x * .5 + .5) * rect.width,\n      y: rect.top + (-screenPoint.y * .5 + .5) * rect.height,\n    } : null;\n    return {\n      key: actor.key,\n      zone: actor.spec.zone,\n      side: actor.spec.side,\n      player: actor.spec.player,\n      selectable: actor.spec.selectable,\n      drawn: actor.spec.drawn,\n      tileId: actor.spec.tileId,\n      group: transformFromActor(actor),\n      target: auditTransform(actor.target),\n      motion: actor.motion ? {\n        start: auditTransform(actor.motion.start),\n        target: auditTransform(actor.motion.target),\n        startedAt: actor.motion.startedAt,\n        duration: actor.motion.duration,\n        arcHeight: actor.motion.arcHeight,\n      } : null,\n      visual: {\n        position: auditVector(actor.visual.position),\n        rotation: auditVector(actor.visual.rotation),\n        worldOffset: auditVector(visualWorldOffset),\n      },\n      screen,\n    };\n  });\n  return {\n    rendererBackend: rendererBackendLabel(rt),\n    hoveredKey: rt.hoveredKey,\n    pressedKey: rt.pressedKey,\n    shadowRefreshSerial: rt.shadowRefreshSerial,\n    actors,\n  };\n}\n\nfunction dispatchAuditSnapshot(): void {\n  if (!runtime) return;\n  window.dispatchEvent(new CustomEvent('mahjong-live:3d-audit', { detail: auditSnapshot(runtime) }));\n}\n`,
  'audit helpers',
);

replaceExact(
  `  let movingCount = 0;`,
  `  let movingCount = 0;\n  let interactionMovingCount = 0;`,
  'interaction moving counter',
);

replaceExact(
  `    if (visualSettling) {\n      const hoverY = hovered ? (pressed ? .08 : .16) : 0;\n      inverseRotation.copy(actor.group.quaternion).invert();\n      hoverOffset.set(0, hoverY, 0).applyQuaternion(inverseRotation);\n      actor.visual.position.lerp(hoverOffset, .22);\n      const targetTiltX = hovered ? -.04 : 0;\n      const targetTiltZ = hovered ? signedHash(actor.key, 'hover') * .042 : 0;\n      actor.visual.rotation.x += (targetTiltX - actor.visual.rotation.x) * .2;\n      actor.visual.rotation.z += (targetTiltZ - actor.visual.rotation.z) * .2;\n      if (!hovered && actor.visual.position.lengthSq() < .000002\n        && Math.abs(actor.visual.rotation.x) < .0005 && Math.abs(actor.visual.rotation.z) < .0005) {\n        actor.visual.position.set(0, 0, 0);\n        actor.visual.rotation.x = 0;\n        actor.visual.rotation.z = 0;\n      }\n    }`,
  `    if (visualSettling) {\n      const beforeX = actor.visual.position.x;\n      const beforeY = actor.visual.position.y;\n      const beforeZ = actor.visual.position.z;\n      const beforeTiltX = actor.visual.rotation.x;\n      const beforeTiltZ = actor.visual.rotation.z;\n      const hoverY = hovered ? (pressed ? .08 : .16) : 0;\n      inverseRotation.copy(actor.group.quaternion).invert();\n      hoverOffset.set(0, hoverY, 0).applyQuaternion(inverseRotation);\n      actor.visual.position.lerp(hoverOffset, .22);\n      const targetTiltX = hovered ? -.04 : 0;\n      const targetTiltZ = hovered ? signedHash(actor.key, 'hover') * .042 : 0;\n      actor.visual.rotation.x += (targetTiltX - actor.visual.rotation.x) * .2;\n      actor.visual.rotation.z += (targetTiltZ - actor.visual.rotation.z) * .2;\n      if (!hovered && actor.visual.position.lengthSq() < .000002\n        && Math.abs(actor.visual.rotation.x) < .0005 && Math.abs(actor.visual.rotation.z) < .0005) {\n        actor.visual.position.set(0, 0, 0);\n        actor.visual.rotation.x = 0;\n        actor.visual.rotation.z = 0;\n      }\n      if (Math.abs(actor.visual.position.x - beforeX) > .000001\n        || Math.abs(actor.visual.position.y - beforeY) > .000001\n        || Math.abs(actor.visual.position.z - beforeZ) > .000001\n        || Math.abs(actor.visual.rotation.x - beforeTiltX) > .000001\n        || Math.abs(actor.visual.rotation.z - beforeTiltZ) > .000001) {\n        interactionMovingCount += 1;\n      }\n    }`,
  'hover movement tracking',
);

replaceExact(
  `  // During motion the cached shadow map must follow the moving tile. Once motion ends it freezes\n  // again, avoiding dozens/hundreds of shadow-pass draw calls on every otherwise static frame.\n  if (movingCount > 0 && rt.renderer.shadowMap?.enabled) rt.renderer.shadowMap.needsUpdate = true;`,
  `  // During table motion *and* local hover/lift/settle motion the cached shadow map must follow\n  // the visible tile. Once both stop it freezes again, preserving the static-table fast path.\n  if ((movingCount > 0 || interactionMovingCount > 0) && rt.renderer.shadowMap?.enabled) {\n    rt.renderer.shadowMap.needsUpdate = true;\n    rt.shadowRefreshSerial += 1;\n  }`,
  'shadow refresh for interaction motion',
);

replaceExact(
  `        moving: movingCount,`,
  `        moving: movingCount + interactionMovingCount,`,
  'fps moving count',
);

replaceExact(
  `window.addEventListener('mahjong-live:benchmark-stage', (event) => {\n  if (!runtime) return;\n  const raw = (event as CustomEvent<{ stage?: BenchmarkStage }>).detail?.stage ?? 'normal';\n  const allowed: BenchmarkStage[] = ['normal', 'empty', 'table', 'tiles-no-faces', 'no-shadows'];\n  setBenchmarkStage(runtime, allowed.includes(raw) ? raw : 'normal');\n});\n\nwindow.addEventListener('mahjong-live:dev-stress-discards', (event) => {`,
  `window.addEventListener('mahjong-live:benchmark-stage', (event) => {\n  if (!runtime) return;\n  const raw = (event as CustomEvent<{ stage?: BenchmarkStage }>).detail?.stage ?? 'normal';\n  const allowed: BenchmarkStage[] = ['normal', 'empty', 'table', 'tiles-no-faces', 'no-shadows'];\n  setBenchmarkStage(runtime, allowed.includes(raw) ? raw : 'normal');\n});\n\nwindow.addEventListener('mahjong-live:3d-audit-request', dispatchAuditSnapshot);\n\nwindow.addEventListener('mahjong-live:dev-stress-discards', (event) => {`,
  'audit request listener',
);

await writeFile(path, source, 'utf8');
console.log('Applied 3D audit bridge and hover-shadow refresh patch.');
