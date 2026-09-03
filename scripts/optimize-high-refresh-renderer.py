from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Missing patch target: {label}')
    return text.replace(old, new, 1)


p = Path('client/src/table-3d.ts')
text = p.read_text(encoding='utf-8')

text = replace_once(text,
"  fpsFrames: number;\n  fpsSampleStart: number;\n};",
"  fpsFrames: number;\n  fpsSampleStart: number;\n  lastFrameAt: number;\n  frameIntervalTotal: number;\n  renderTimeTotal: number;\n};",
'runtime diagnostics fields')

text = replace_once(text,
"  const material = new rt.THREE.MeshStandardMaterial({\n    map: texture,\n    color: tuning.tiles.faceTint,\n    roughness: .56,\n    metalness: 0,",
"  // Printed artwork does not need a PBR shader. Lambert keeps the same scene lighting while\n  // making the many unique SVG face materials substantially cheaper to render.\n  const material = new rt.THREE.MeshLambertMaterial({\n    map: texture,\n    color: tuning.tiles.faceTint,",
'face lambert material')

text = replace_once(text,
"  rearShell.castShadow = true;\n  rearShell.receiveShadow = true;",
"  // The ivory body already supplies the silhouette in the shadow map; shadowing the thin rear\n  // cap a second time only duplicates work for every tile.\n  rearShell.castShadow = false;\n  rearShell.receiveShadow = false;",
'rear shell shadow cost')

text = replace_once(text,
"  face.renderOrder = 4;\n  face.receiveShadow = true;\n  visual.add(face);",
"  face.renderOrder = 4;\n  face.receiveShadow = false;\n  face.visible = !spec.back;\n  visual.add(face);",
'face visibility')

text = replace_once(text,
"  rear.renderOrder = 2;\n  rear.receiveShadow = true;\n  visual.add(rear);",
"  rear.renderOrder = 2;\n  rear.receiveShadow = false;\n  rear.visible = spec.back;\n  visual.add(rear);",
'rear visibility')

text = replace_once(text,
"function refreshActor(rt: TableRuntime, actor: TileActor, spec: TileSpec): void {\n  const changedFace = actor.spec.label !== spec.label || actor.spec.back !== spec.back;\n  actor.spec = spec;\n  if (changedFace) actor.face.material = materialForFace(rt, spec.label, spec.back);\n  actor.indicator.visible = spec.advised;\n  actor.latestHalo.visible = spec.latest && reactionClaimAvailable();\n}",
"function refreshActor(rt: TableRuntime, actor: TileActor, spec: TileSpec): void {\n  const changedFace = actor.spec.label !== spec.label || actor.spec.back !== spec.back;\n  actor.spec = spec;\n  if (changedFace) actor.face.material = materialForFace(rt, spec.label, spec.back);\n  // The body already closes both sides. Draw only the printed plane that can actually be seen:\n  // artwork on face-up tiles, patterned rear on concealed opponent tiles. This removes one draw\n  // call per tile, which matters a lot once rivers fill up.\n  actor.face.visible = !spec.back;\n  actor.rear.visible = spec.back;\n  actor.indicator.visible = spec.advised;\n  actor.latestHalo.visible = spec.latest && reactionClaimAvailable();\n}",
'refresh visible planes')

text = replace_once(text,
"  const backMaterial = new THREE.MeshStandardMaterial({\n    color: tuning.backColor, roughness: .62, metalness: 0,\n    side: THREE.DoubleSide,\n  });",
"  const backMaterial = new THREE.MeshLambertMaterial({\n    color: tuning.backColor,\n    side: THREE.DoubleSide,\n  });",
'back lambert material')

text = replace_once(text,
"    fpsFrames: 0,\n    fpsSampleStart: performance.now(),\n  };",
"    fpsFrames: 0,\n    fpsSampleStart: performance.now(),\n    lastFrameAt: 0,\n    frameIntervalTotal: 0,\n    renderTimeTotal: 0,\n  };",
'initialize diagnostics')

old_frame = '''function frameRuntime(rt: TableRuntime, time: number): void {
  if (rt.disposed || !enabled || !rt.table || !stage.classList.contains('is-active')) return;

  const hoverOffset = new rt.THREE.Vector3();
  const groundOffset = new rt.THREE.Vector3();
  const inverseRotation = new rt.THREE.Quaternion();
  const groundRotation = new rt.THREE.Quaternion().setFromEuler(new rt.THREE.Euler(-Math.PI / 2, 0, 0));
  for (const actor of rt.actors.values()) {
    if (actor.motion) {
      const motion = actor.motion;
      const progress = Math.max(0, Math.min(1, (time - motion.startedAt) / motion.duration));
      const eased = progress * progress * (3 - 2 * progress);
      const settle = Math.sin(progress * Math.PI * 3) * .022 * (1 - progress);
      actor.group.position.x = lerp(motion.start.x, motion.target.x, eased);
      actor.group.position.z = lerp(motion.start.z, motion.target.z, eased);
      actor.group.position.y = lerp(motion.start.y, motion.target.y, eased)
        + Math.sin(progress * Math.PI) * motion.arcHeight
        + settle;
      actor.group.rotation.x = lerpAngle(motion.start.pitch, motion.target.pitch, eased);
      actor.group.rotation.y = lerpAngle(motion.start.yaw, motion.target.yaw, eased);
      actor.group.rotation.z = lerpAngle(motion.start.roll, motion.target.roll, eased);
      const scale = lerp(motion.start.scale, motion.target.scale, eased);
      actor.group.scale.setScalar(scale);
      if (progress >= 1) {
        actor.motion = null;
        applyTransform(actor, motion.target);
      }
    }

    // Keep halos on the felt in world space. They no longer rotate/lift with the tile, so the
    // highlight reads as a pool of light underneath instead of a ring behind the face.
    const feltTop = rt.felt.position.y + rt.felt.scale.y / 2 + .008;
    inverseRotation.copy(actor.group.quaternion).invert();
    groundOffset.set(0, feltTop - actor.group.position.y, 0).applyQuaternion(inverseRotation);
    actor.indicator.position.copy(groundOffset);
    actor.latestHalo.position.copy(groundOffset);
    actor.indicator.quaternion.copy(inverseRotation).multiply(groundRotation);
    actor.latestHalo.quaternion.copy(inverseRotation).multiply(groundRotation);

    const hovered = rt.hoveredKey === actor.key && actor.spec.selectable;
    const pressed = rt.pressedKey === actor.key && hovered;
    const hoverY = hovered ? (pressed ? .08 : .16) : 0;
    // Lift in world Y regardless of how the tile itself is rotated. Previously local-Y pushed
    // standing tiles toward the camera instead of visibly raising them above the rack.
    hoverOffset.set(0, hoverY, 0).applyQuaternion(inverseRotation.copy(actor.group.quaternion).invert());
    actor.visual.position.lerp(hoverOffset, .22);
    const targetTiltX = hovered ? -.04 : 0;
    const targetTiltZ = hovered ? signedHash(actor.key, 'hover') * .042 : 0;
    actor.visual.rotation.x += (targetTiltX - actor.visual.rotation.x) * .2;
    actor.visual.rotation.z += (targetTiltZ - actor.visual.rotation.z) * .2;
    actor.indicator.visible = actor.spec.advised || hovered;
    const claimableLatest = actor.spec.latest && reactionClaimAvailable();
    actor.latestHalo.visible = claimableLatest;
    if (claimableLatest && !reducedMotion) {
      const pulse = 1 + Math.sin(time / 180) * .055;
      actor.latestHalo.scale.setScalar(pulse);
    } else {
      actor.latestHalo.scale.setScalar(1);
    }
  }

  rt.renderer.render(rt.scene, rt.camera);
  rt.fpsFrames += 1;
  const sampleMs = time - rt.fpsSampleStart;
  if (sampleMs >= 600) {
    if (document.body.classList.contains('dev-tuning-open')) {
      window.dispatchEvent(new CustomEvent('mahjong-live:fps', { detail: {
        fps: rt.fpsFrames * 1000 / sampleMs,
        calls: rt.renderer.info.render.calls,
        triangles: rt.renderer.info.render.triangles,
        pixelRatio: rt.renderer.getPixelRatio(),
      } }));
    }
    rt.fpsFrames = 0;
    rt.fpsSampleStart = time;
  }
}
'''

new_frame = '''function frameRuntime(rt: TableRuntime, time: number): void {
  if (rt.disposed || !enabled || !rt.table || !stage.classList.contains('is-active')) return;

  if (rt.lastFrameAt > 0) rt.frameIntervalTotal += time - rt.lastFrameAt;
  rt.lastFrameAt = time;

  // The old loop recomputed two inverse quaternions and all halo transforms for *every* tile on
  // every refresh tick. At 120 Hz and a full table that CPU bookkeeping was more expensive than
  // changing resolution or the background. Static actors now do almost no per-frame work.
  const hoverOffset = new rt.THREE.Vector3();
  const groundOffset = new rt.THREE.Vector3();
  const inverseRotation = new rt.THREE.Quaternion();
  const groundRotation = new rt.THREE.Quaternion().setFromEuler(new rt.THREE.Euler(-Math.PI / 2, 0, 0));
  const feltTop = rt.felt.position.y + rt.felt.scale.y / 2 + .008;
  const anyClaim = reactionClaimAvailable();
  let movingCount = 0;

  for (const actor of rt.actors.values()) {
    let transformMoved = false;
    if (actor.motion) {
      movingCount += 1;
      transformMoved = true;
      const motion = actor.motion;
      const progress = Math.max(0, Math.min(1, (time - motion.startedAt) / motion.duration));
      const eased = progress * progress * (3 - 2 * progress);
      const settle = Math.sin(progress * Math.PI * 3) * .022 * (1 - progress);
      actor.group.position.x = lerp(motion.start.x, motion.target.x, eased);
      actor.group.position.z = lerp(motion.start.z, motion.target.z, eased);
      actor.group.position.y = lerp(motion.start.y, motion.target.y, eased)
        + Math.sin(progress * Math.PI) * motion.arcHeight
        + settle;
      actor.group.rotation.x = lerpAngle(motion.start.pitch, motion.target.pitch, eased);
      actor.group.rotation.y = lerpAngle(motion.start.yaw, motion.target.yaw, eased);
      actor.group.rotation.z = lerpAngle(motion.start.roll, motion.target.roll, eased);
      const scale = lerp(motion.start.scale, motion.target.scale, eased);
      actor.group.scale.setScalar(scale);
      if (progress >= 1) {
        actor.motion = null;
        applyTransform(actor, motion.target);
      }
    }

    const hovered = rt.hoveredKey === actor.key && actor.spec.selectable;
    const pressed = rt.pressedKey === actor.key && hovered;
    const visualSettling = hovered
      || actor.visual.position.lengthSq() > .000002
      || Math.abs(actor.visual.rotation.x) > .0005
      || Math.abs(actor.visual.rotation.z) > .0005;

    // Ground-space halo compensation is only required while the actor itself changes transform.
    // Static discards keep the already-correct local transform instead of recalculating it 120x/s.
    if (transformMoved) {
      inverseRotation.copy(actor.group.quaternion).invert();
      groundOffset.set(0, feltTop - actor.group.position.y, 0).applyQuaternion(inverseRotation);
      actor.indicator.position.copy(groundOffset);
      actor.latestHalo.position.copy(groundOffset);
      actor.indicator.quaternion.copy(inverseRotation).multiply(groundRotation);
      actor.latestHalo.quaternion.copy(inverseRotation).multiply(groundRotation);
    }

    if (visualSettling) {
      const hoverY = hovered ? (pressed ? .08 : .16) : 0;
      inverseRotation.copy(actor.group.quaternion).invert();
      hoverOffset.set(0, hoverY, 0).applyQuaternion(inverseRotation);
      actor.visual.position.lerp(hoverOffset, .22);
      const targetTiltX = hovered ? -.04 : 0;
      const targetTiltZ = hovered ? signedHash(actor.key, 'hover') * .042 : 0;
      actor.visual.rotation.x += (targetTiltX - actor.visual.rotation.x) * .2;
      actor.visual.rotation.z += (targetTiltZ - actor.visual.rotation.z) * .2;
      if (!hovered && actor.visual.position.lengthSq() < .000002
        && Math.abs(actor.visual.rotation.x) < .0005 && Math.abs(actor.visual.rotation.z) < .0005) {
        actor.visual.position.set(0, 0, 0);
        actor.visual.rotation.x = 0;
        actor.visual.rotation.z = 0;
      }
    }

    actor.indicator.visible = actor.spec.advised || hovered;
    const claimableLatest = actor.spec.latest && anyClaim;
    actor.latestHalo.visible = claimableLatest;
    if (claimableLatest && !reducedMotion) {
      const pulse = 1 + Math.sin(time / 180) * .055;
      actor.latestHalo.scale.setScalar(pulse);
    } else if (actor.latestHalo.scale.x !== 1) {
      actor.latestHalo.scale.setScalar(1);
    }
  }

  const renderStarted = performance.now();
  rt.renderer.render(rt.scene, rt.camera);
  rt.renderTimeTotal += performance.now() - renderStarted;
  rt.fpsFrames += 1;
  const sampleMs = time - rt.fpsSampleStart;
  if (sampleMs >= 600) {
    if (document.body.classList.contains('dev-tuning-open')) {
      const intervals = Math.max(1, rt.fpsFrames - 1);
      const frameMs = rt.frameIntervalTotal / intervals;
      window.dispatchEvent(new CustomEvent('mahjong-live:fps', { detail: {
        fps: rt.fpsFrames * 1000 / sampleMs,
        frameMs,
        renderMs: rt.renderTimeTotal / Math.max(1, rt.fpsFrames),
        calls: rt.renderer.info.render.calls,
        triangles: rt.renderer.info.render.triangles,
        actors: rt.actors.size,
        moving: movingCount,
        pixelRatio: rt.renderer.getPixelRatio(),
      } }));
    }
    rt.fpsFrames = 0;
    rt.fpsSampleStart = time;
    rt.frameIntervalTotal = 0;
    rt.renderTimeTotal = 0;
  }
}
'''
text = replace_once(text, old_frame, new_frame, 'frame loop')

# New actors need a correct static ground halo once, since the optimized frame loop intentionally
# skips those calculations for actors that are not moving.
text = replace_once(text,
"  applyTransform(actor, initial);\n  rt.actorRoot.add(group);\n  return actor;",
"  applyTransform(actor, initial);\n  rt.actorRoot.add(group);\n  const feltTop = rt.felt.position.y + rt.felt.scale.y / 2 + .008;\n  const inverse = new THREE.Quaternion().copy(group.quaternion).invert();\n  const ground = new THREE.Vector3(0, feltTop - group.position.y, 0).applyQuaternion(inverse);\n  const groundRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));\n  indicator.position.copy(ground);\n  latestHalo.position.copy(ground);\n  indicator.quaternion.copy(inverse).multiply(groundRotation);\n  latestHalo.quaternion.copy(inverse).multiply(groundRotation);\n  return actor;",
'initial halo transform')

text = replace_once(text,
"  rt.actors.delete(actor.key);\n  actor.group.removeFromParent();",
"  rt.actors.delete(actor.key);\n  actor.group.removeFromParent();",
'remove actor noop marker')

p.write_text(text, encoding='utf-8')

p = Path('client/src/dev-tuning.ts')
text = p.read_text(encoding='utf-8')
old_listener = """window.addEventListener('mahjong-live:fps', (event) => {
  const detail = (event as CustomEvent<{ fps?: number; calls?: number; triangles?: number; pixelRatio?: number }>).detail;
  const target = panel?.querySelector<HTMLElement>('.dev-fps-value');
  if (!target || !detail) return;
  const fps = Number.isFinite(detail.fps) ? Math.round(detail.fps ?? 0) : 0;
  target.textContent = `${fps} FPS · ${detail.calls ?? 0} calls · ${(detail.pixelRatio ?? 1).toFixed(2)}×`;
  target.classList.toggle('fps-low', fps > 0 && fps < 45);
});"""
new_listener = """window.addEventListener('mahjong-live:fps', (event) => {
  const detail = (event as CustomEvent<{
    fps?: number; frameMs?: number; renderMs?: number; calls?: number; triangles?: number;
    actors?: number; moving?: number; pixelRatio?: number;
  }>).detail;
  const target = panel?.querySelector<HTMLElement>('.dev-fps-value');
  if (!target || !detail) return;
  const fps = Number.isFinite(detail.fps) ? Math.round(detail.fps ?? 0) : 0;
  const frameMs = Number.isFinite(detail.frameMs) ? (detail.frameMs ?? 0).toFixed(2) : '--';
  const renderMs = Number.isFinite(detail.renderMs) ? (detail.renderMs ?? 0).toFixed(2) : '--';
  target.textContent = `${fps} FPS · ${frameMs}ms frame · ${renderMs}ms render · ${detail.calls ?? 0} calls · ${detail.actors ?? 0} tiles`;
  target.title = `${detail.triangles ?? 0} triangles · ${detail.moving ?? 0} moving · ${(detail.pixelRatio ?? 1).toFixed(2)}× pixel ratio`;
  target.classList.toggle('fps-low', fps > 0 && fps < 55);
});"""
text = replace_once(text, old_listener, new_listener, 'fps diagnostics UI')

text = replace_once(text,
"The browser animation loop is VSync-capped, so a 60 Hz display normally reports ~60 FPS even when the GPU could render far more. These sliders change GPU headroom/quality; FPS will only drop once the renderer can no longer sustain the display refresh. Pixel ratio has the biggest cost. Shadow quality: 0=off, 1=512, 2=1024, 3=2048.",
"The renderer has no 60 FPS limiter and follows the browser requestAnimationFrame cadence, so a foreground window on a 120 Hz display can render at ~120 FPS. The diagnostics above separate frame interval from CPU render submission time. Background color is essentially free; tile count/draw calls and per-tile CPU work are the important costs. Pixel ratio has the biggest GPU cost. Shadow quality: 0=off, 1=512, 2=1024, 3=2048.",
'graphics note')

p.write_text(text, encoding='utf-8')
