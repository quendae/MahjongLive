from pathlib import Path
from urllib.request import urlopen
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'client' / 'public' / 'tiles' / 'riichi-regular'
OUT.mkdir(parents=True, exist_ok=True)

FILES = [
    *(f'Man{i}.svg' for i in range(1, 10)), 'Man5-Dora.svg',
    *(f'Pin{i}.svg' for i in range(1, 10)), 'Pin5-Dora.svg',
    *(f'Sou{i}.svg' for i in range(1, 10)), 'Sou5-Dora.svg',
    'Ton.svg', 'Nan.svg', 'Shaa.svg', 'Pei.svg', 'Haku.svg', 'Hatsu.svg', 'Chun.svg',
]
BASE = 'https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/'
for name in FILES:
    print('Downloading', name)
    OUT.joinpath(name).write_bytes(urlopen(BASE + name, timeout=30).read())

license_text = urlopen(
    'https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/LICENSE.md',
    timeout=30,
).read().decode('utf-8')
OUT.joinpath('LICENSE.md').write_text(license_text, encoding='utf-8')
OUT.joinpath('SOURCE.md').write_text(
    '# Riichi Mahjong tile artwork\n\n'
    'Source: https://github.com/FluffyStuff/riichi-mahjong-tiles\n\n'
    'This directory contains the Regular/light SVG set used for MahjongLive tile fronts. '
    'The upstream project dedicates the artwork to the public domain under CC0.\n',
    encoding='utf-8',
)

path = ROOT / 'client' / 'src' / 'table-3d.ts'
text = path.read_text(encoding='utf-8')
pattern = re.compile(
    r"function materialForFace\(rt: TableRuntime, label: string \| null, back = false\): any \{.*?\n\}\n\nfunction syncFaceMode",
    re.S,
)
replacement = '''function materialForFace(rt: TableRuntime, label: string | null, back = false): any {
  if (back) return rt.ivoryMaterial;
  const key = `${rt.faceMode}:${label ?? 'blank'}`;
  const cached = rt.faceMaterials.get(key);
  if (cached) return cached;
  const tuning = readDevTuning();
  let texture: any = null;
  const canvas = createFaceCanvas(label, false, rt.faceMode, () => {
    if (texture) texture.needsUpdate = true;
  });
  texture = new rt.THREE.CanvasTexture(canvas);
  texture.colorSpace = rt.THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(readDevTuning().graphics.anisotropy, rt.renderer.capabilities.getMaxAnisotropy());
  texture.center.set(.5, .5);
  texture.rotation = radians(tuning.tiles.faceTextureRotation);
  const material = new rt.THREE.MeshStandardMaterial({
    map: texture,
    color: tuning.tiles.faceTint,
    roughness: .56,
    metalness: 0,
    side: rt.THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  rt.faceMaterials.set(key, material);
  return material;
}

function syncFaceMode'''
updated, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'Could not patch materialForFace; replacements={count}')
path.write_text(updated, encoding='utf-8')
print(f'Imported {len(FILES)} SVG assets and patched asynchronous CanvasTexture refresh.')
