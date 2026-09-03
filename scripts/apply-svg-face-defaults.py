from pathlib import Path


def patch(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f'Missing patch target in {path}: {old!r}')
        text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')


for path in ['client/src/dev-tuning.ts', 'client/src/table-3d.ts']:
    patch(path, [
        ('    faceScale: 1.1,', '    faceScale: .87,'),
        ("    bodyColor: '#ffffff',", "    bodyColor: '#fbfbfb',"),
        ("    faceTint: '#ffffff',", "    faceTint: '#fbfbfb',"),
    ])

patch('client/src/dev-tuning.ts', [
    (
        "if (settings.right.x === -90 && settings.right.z === 90 && settings.right.y === 0) settings.right.y = 180;\nlet panel: HTMLElement | null = null;",
        "if (settings.right.x === -90 && settings.right.z === 90 && settings.right.y === 0) settings.right.y = 180;\n"
        "// Migrate the previous exact visual defaults so existing localStorage picks up the SVG-tuned baseline.\n"
        "if (Math.abs(settings.tiles.faceScale - 1.1) < .0001) settings.tiles.faceScale = .87;\n"
        "if (settings.tiles.bodyColor.toLowerCase() === '#ffffff') settings.tiles.bodyColor = '#fbfbfb';\n"
        "if (settings.tiles.faceTint.toLowerCase() === '#ffffff') settings.tiles.faceTint = '#fbfbfb';\n"
        "let panel: HTMLElement | null = null;"
    ),
    (
        "  numberSlider(tileSection, 'Called tile gap', 0, .30, .01, () => settings.tiles.calledTileGap, (v) => { settings.tiles.calledTileGap = v; }, '', DEFAULTS.tiles.calledTileGap);",
        "  numberSlider(tileSection, 'Called tile gap', -.30, .30, .01, () => settings.tiles.calledTileGap, (v) => { settings.tiles.calledTileGap = v; }, '', DEFAULTS.tiles.calledTileGap);"
    ),
    (
        "  graphics.insertAdjacentHTML('beforeend', '<p class=\"dev-tuning-note\">Pixel ratio has the biggest FPS impact. Shadow quality: 0=off, 1=512, 2=1024, 3=2048. Raise filtering for sharper angled tile/table textures.</p>');",
        "  graphics.insertAdjacentHTML('beforeend', '<p class=\"dev-tuning-note\">The browser animation loop is VSync-capped, so a 60 Hz display normally reports ~60 FPS even when the GPU could render far more. These sliders change GPU headroom/quality; FPS will only drop once the renderer can no longer sustain the display refresh. Pixel ratio has the biggest cost. Shadow quality: 0=off, 1=512, 2=1024, 3=2048.</p>');"
    ),
])

# readDevTuning() is cached separately from the dev panel, so migrate legacy exact values there too.
patch('client/src/table-3d.ts', [
    (
        "  if (Math.abs(parsed.tiles.riverRowGap - .55) < .0001) parsed.tiles.riverRowGap = .60;\n"
        "  if (parsed.left.x === -90 && parsed.left.z === -90 && parsed.left.y === 0) parsed.left.y = 180;\n"
        "  if (parsed.right.x === -90 && parsed.right.z === 90 && parsed.right.y === 0) parsed.right.y = 180;\n"
        "  devTuningCache = parsed;",
        "  if (Math.abs(parsed.tiles.riverRowGap - .55) < .0001) parsed.tiles.riverRowGap = .60;\n"
        "  if (parsed.left.x === -90 && parsed.left.z === -90 && parsed.left.y === 0) parsed.left.y = 180;\n"
        "  if (parsed.right.x === -90 && parsed.right.z === 90 && parsed.right.y === 0) parsed.right.y = 180;\n"
        "  if (Math.abs(parsed.tiles.faceScale - 1.1) < .0001) parsed.tiles.faceScale = .87;\n"
        "  if (parsed.tiles.bodyColor.toLowerCase() === '#ffffff') parsed.tiles.bodyColor = '#fbfbfb';\n"
        "  if (parsed.tiles.faceTint.toLowerCase() === '#ffffff') parsed.tiles.faceTint = '#fbfbfb';\n"
        "  devTuningCache = parsed;"
    ),
])
