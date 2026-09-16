import { readFile, writeFile } from 'node:fs/promises';

const path = 'client/src/table-3d.ts';
let source = await readFile(path, 'utf8');

if (source.includes('const hoverBlend = 1 - Math.exp(-frameDeltaMs / 67);')) {
  console.log('3D time-based hover damping already applied.');
  process.exit(0);
}

function replaceExact(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceExact(
  `  pollGpuTimer(rt);\n  if (rt.lastFrameAt > 0) rt.frameIntervalTotal += time - rt.lastFrameAt;\n  rt.lastFrameAt = time;`,
  `  pollGpuTimer(rt);\n  // Hover/lift used to interpolate by a fixed amount per rendered frame. That made the same\n  // interaction much slower on throttled/30 Hz renderers and much faster at 120+ Hz. Preserve the\n  // old ~60 Hz feel with exponential, wall-clock-based damping instead.\n  const frameDeltaMs = rt.lastFrameAt > 0\n    ? Math.max(0, Math.min(250, time - rt.lastFrameAt))\n    : 1000 / 60;\n  if (rt.lastFrameAt > 0) rt.frameIntervalTotal += time - rt.lastFrameAt;\n  rt.lastFrameAt = time;`,
  'frame delta',
);

replaceExact(
  `      const hoverY = hovered ? (pressed ? .08 : .16) : 0;\n      inverseRotation.copy(actor.group.quaternion).invert();\n      hoverOffset.set(0, hoverY, 0).applyQuaternion(inverseRotation);\n      actor.visual.position.lerp(hoverOffset, .22);\n      const targetTiltX = hovered ? -.04 : 0;\n      const targetTiltZ = hovered ? signedHash(actor.key, 'hover') * .042 : 0;\n      actor.visual.rotation.x += (targetTiltX - actor.visual.rotation.x) * .2;\n      actor.visual.rotation.z += (targetTiltZ - actor.visual.rotation.z) * .2;`,
  `      const hoverY = hovered ? (pressed ? .08 : .16) : 0;\n      inverseRotation.copy(actor.group.quaternion).invert();\n      hoverOffset.set(0, hoverY, 0).applyQuaternion(inverseRotation);\n      // 67/75 ms time constants reproduce the previous .22/.20 blend at 60 Hz while keeping\n      // lift and settle duration stable across 30, 60, 120 Hz and temporarily throttled RAF.\n      const hoverBlend = 1 - Math.exp(-frameDeltaMs / 67);\n      const tiltBlend = 1 - Math.exp(-frameDeltaMs / 75);\n      actor.visual.position.lerp(hoverOffset, hoverBlend);\n      const targetTiltX = hovered ? -.04 : 0;\n      const targetTiltZ = hovered ? signedHash(actor.key, 'hover') * .042 : 0;\n      actor.visual.rotation.x += (targetTiltX - actor.visual.rotation.x) * tiltBlend;\n      actor.visual.rotation.z += (targetTiltZ - actor.visual.rotation.z) * tiltBlend;`,
  'time-based hover damping',
);

await writeFile(path, source, 'utf8');
console.log('Applied frame-rate-independent 3D hover/lift/settle damping.');
