from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing patch target: {label}")
    return text.replace(old, new, 1)


def replace_regex(text: str, pattern: str, repl: str, label: str, flags=0) -> str:
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Expected one regex target for {label}, got {count}")
    return out


def patch(path: str, transform):
    p = Path(path)
    before = p.read_text()
    after = transform(before)
    if after == before:
        raise RuntimeError(f"No changes made to {path}")
    p.write_text(after)


# --- main.ts: preserve physical tile IDs for opponent draw/discard animation and mark called meld tile.
def patch_main(text: str) -> str:
    text = replace_once(
        text,
        """    called?: boolean;\n    advised?: boolean;""",
        """    called?: boolean;\n    meldCalled?: boolean;\n    calledFrom?: PlayerIndex;\n    advised?: boolean;""",
        "tile markup options",
    )
    text = replace_once(
        text,
        """  if (options.called) classes.push('tile-called');\n  if (options.advised) classes.push('tile-advised');\n  const attrs = options.clickable && id >= 0 ? ` data-tile-id=\"${id}\" role=\"button\" tabindex=\"0\"` : '';\n  const title = options.adviceText ? ` title=\"${options.adviceText}\"` : '';\n  return `<div class=\"${classes.join(' ')}\" aria-label=\"${tileLabel(tile)}\"${attrs}${title}>${tileFace(tile)}</div>`;""",
        """  if (options.called) classes.push('tile-called');\n  if (options.meldCalled) classes.push('tile-meld-called');\n  if (options.advised) classes.push('tile-advised');\n  const engineAttr = id >= 0 ? ` data-engine-tile-id=\"${id}\"` : '';\n  const actionAttr = options.clickable && id >= 0 ? ` data-tile-id=\"${id}\" role=\"button\" tabindex=\"0\"` : '';\n  const calledFromAttr = options.calledFrom !== undefined ? ` data-called-from=\"${options.calledFrom}\"` : '';\n  const title = options.adviceText ? ` title=\"${options.adviceText}\"` : '';\n  return `<div class=\"${classes.join(' ')}\" aria-label=\"${tileLabel(tile)}\"${engineAttr}${actionAttr}${calledFromAttr}${title}>${tileFace(tile)}</div>`;""",
        "persistent tile ids",
    )
    text = replace_once(
        text,
        """function tileBackMarkup(compact = false): string {\n  return `<div class=\"tile tile-back${compact ? ' tile-compact' : ''}\" aria-hidden=\"true\"><span></span></div>`;\n}""",
        """function tileBackMarkup(\n  compact = false,\n  options: { engineTileId?: number; drawn?: boolean } = {},\n): string {\n  const idAttr = typeof options.engineTileId === 'number' ? ` data-engine-tile-id=\"${options.engineTileId}\"` : '';\n  const classes = `tile tile-back${compact ? ' tile-compact' : ''}${options.drawn ? ' tile-drawn' : ''}`;\n  return `<div class=\"${classes}\" aria-hidden=\"true\"${idAttr}><span></span></div>`;\n}""",
        "back markup ids",
    )
    text = replace_regex(
        text,
        r"function meldMarkup\(meld: PlayerMeld\): string \{.*?\n\}",
        """function meldMarkup(meld: PlayerMeld): string {\n  const hiddenOuter = meld.type === 'quad' && meld.isOpen !== true;\n  return `<div class=\"meld meld-${meld.type}\">${meld.tiles\n    .map((tile, index) => {\n      if (hiddenOuter && (index === 0 || index === meld.tiles.length - 1)) {\n        return tileBackMarkup(true, { engineTileId: tile.id });\n      }\n      const meldCalled = meld.calledTileId !== undefined && tile.id === meld.calledTileId;\n      return tileMarkup(tile, {\n        compact: true,\n        meldCalled,\n        calledFrom: meldCalled ? meld.calledFrom : undefined,\n      });\n    })\n    .join('')}</div>`;\n}""",
        "called meld markup",
        flags=re.S,
    )
    text = replace_once(
        text,
        """  const concealedCount = Math.max(0, state.concealed.length);\n  const backs = Array.from({ length: concealedCount }, () => tileBackMarkup(true)).join('');""",
        """  const concealedCount = Math.max(0, state.concealed.length);\n  const drawnId = round.phase.kind === 'awaiting-discard' && round.phase.player === player\n    ? round.phase.drawnTileId\n    : null;\n  const backs = state.concealed.map((tile) => tileBackMarkup(true, {\n    engineTileId: tile.id,\n    drawn: drawnId !== null && tile.id === drawnId,\n  })).join('');""",
        "opponent rack physical ids",
    )
    return text


patch('client/src/main.ts', patch_main)


# --- dev-tuning.ts: new defaults, meld spacing controls, back texture presets/custom image.
def patch_dev(text: str) -> str:
    text = replace_once(text, "left: { x: -90, y: 0, z: -90 },", "left: { x: -90, y: 180, z: -90 },", "left default y")
    text = replace_once(text, "right: { x: -90, y: 0, z: 90 },", "right: { x: -90, y: 180, z: 90 },", "right default y")
    text = replace_once(
        text,
        """    riverTiltJitter: number;\n  };""",
        """    riverTiltJitter: number;\n    meldGap: number;\n    meldRowGap: number;\n    calledTileRotation: number;\n  };""",
        "dev meld tuning type",
    )
    text = replace_once(
        text,
        """  backColor: string;\n  sceneColor: string;\n};""",
        """  backColor: string;\n  backPattern: string;\n  backPatternStrength: number;\n  backImage: string | null;\n  sceneColor: string;\n};""",
        "dev back pattern type",
    )
    text = replace_once(
        text,
        """    riverTiltJitter: .7,\n  },""",
        """    riverTiltJitter: .7,\n    meldGap: .36,\n    meldRowGap: .48,\n    calledTileRotation: 90,\n  },""",
        "dev meld defaults",
    )
    text = replace_once(
        text,
        """  backColor: '#315c49',\n  sceneColor: '#071b13',""",
        """  backColor: '#315c49',\n  backPattern: 'ribbed',\n  backPatternStrength: .48,\n  backImage: null,\n  sceneColor: '#071b13',""",
        "dev back defaults",
    )
    text = replace_once(
        text,
        """      riverTiltJitter: finite(raw.tiles?.riverTiltJitter, DEFAULTS.tiles.riverTiltJitter),\n    },""",
        """      riverTiltJitter: finite(raw.tiles?.riverTiltJitter, DEFAULTS.tiles.riverTiltJitter),\n      meldGap: finite(raw.tiles?.meldGap, DEFAULTS.tiles.meldGap),\n      meldRowGap: finite(raw.tiles?.meldRowGap, DEFAULTS.tiles.meldRowGap),\n      calledTileRotation: finite(raw.tiles?.calledTileRotation, DEFAULTS.tiles.calledTileRotation),\n    },""",
        "dev meld loader",
    )
    text = replace_once(
        text,
        """    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,\n    sceneColor: typeof raw.sceneColor === 'string' ? raw.sceneColor : DEFAULTS.sceneColor,""",
        """    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,\n    backPattern: typeof raw.backPattern === 'string' ? raw.backPattern : DEFAULTS.backPattern,\n    backPatternStrength: finite(raw.backPatternStrength, DEFAULTS.backPatternStrength),\n    backImage: typeof raw.backImage === 'string' ? raw.backImage : null,\n    sceneColor: typeof raw.sceneColor === 'string' ? raw.sceneColor : DEFAULTS.sceneColor,""",
        "dev back loader",
    )
    text = replace_once(
        text,
        """let settings = loadSettings();\nif (Math.abs(settings.tiles.riverRowGap - .55) < .0001) settings.tiles.riverRowGap = .60;""",
        """let settings = loadSettings();\nif (Math.abs(settings.tiles.riverRowGap - .55) < .0001) settings.tiles.riverRowGap = .60;\nif (settings.left.x === -90 && settings.left.z === -90 && settings.left.y === 0) settings.left.y = 180;\nif (settings.right.x === -90 && settings.right.z === 90 && settings.right.y === 0) settings.right.y = 180;""",
        "dev rotation migration",
    )
    text = replace_once(
        text,
        """async function optimizedTableImage(file: File): Promise<string> {""",
        """async function optimizedBackImage(file: File): Promise<string> {\n  const bitmap = await createImageBitmap(file);\n  try {\n    const maxDimension = 768;\n    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));\n    const canvas = document.createElement('canvas');\n    canvas.width = Math.max(1, Math.round(bitmap.width * scale));\n    canvas.height = Math.max(1, Math.round(bitmap.height * scale));\n    const ctx = canvas.getContext('2d', { alpha: false });\n    if (!ctx) throw new Error('Could not create image canvas');\n    ctx.imageSmoothingEnabled = true;\n    ctx.imageSmoothingQuality = 'high';\n    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);\n    return canvas.toDataURL('image/webp', .82);\n  } finally {\n    bitmap.close?.();\n  }\n}\n\nasync function optimizedTableImage(file: File): Promise<string> {""",
        "back image optimizer",
    )
    text = replace_once(
        text,
        """  numberSlider(tileSection, 'Meld size', .50, 1.40, .01, () => settings.tiles.meldScale, (v) => { settings.tiles.meldScale = v; }, '×', DEFAULTS.tiles.meldScale);""",
        """  numberSlider(tileSection, 'Meld size', .50, 1.40, .01, () => settings.tiles.meldScale, (v) => { settings.tiles.meldScale = v; }, '×', DEFAULTS.tiles.meldScale);\n  numberSlider(tileSection, 'Meld gap', .30, .55, .01, () => settings.tiles.meldGap, (v) => { settings.tiles.meldGap = v; }, '', DEFAULTS.tiles.meldGap);\n  numberSlider(tileSection, 'Meld row gap', .38, .70, .01, () => settings.tiles.meldRowGap, (v) => { settings.tiles.meldRowGap = v; }, '', DEFAULTS.tiles.meldRowGap);\n  numberSlider(tileSection, 'Called tile turn', -180, 180, 1, () => settings.tiles.calledTileRotation, (v) => { settings.tiles.calledTileRotation = v; }, '°', DEFAULTS.tiles.calledTileRotation);""",
        "dev meld controls",
    )
    marker = """  colorControl(surfaces, 'Back RGB', () => settings.backColor, (v) => { settings.backColor = v; preset.value = ''; }, DEFAULTS.backColor);\n  surfaces.insertAdjacentHTML('beforeend', '<p class=\"dev-tuning-note\">The colored back is a physical cap around the rear face; the pattern itself stays slightly inset.</p>');"""
    replacement = """  colorControl(surfaces, 'Back RGB', () => settings.backColor, (v) => { settings.backColor = v; preset.value = ''; }, DEFAULTS.backColor);\n\n  const patternRow = document.createElement('div');\n  patternRow.className = 'dev-tuning-presets';\n  const patternLabel = document.createElement('label'); patternLabel.textContent = 'Back texture';\n  const pattern = document.createElement('select');\n  const patterns: [string, string][] = [\n    ['Fine ribs', 'ribbed'], ['Woven', 'woven'], ['Diamonds', 'diamond'],\n    ['Soft waves', 'waves'], ['Classic lattice', 'classic'], ['Solid', 'solid'], ['Custom image', 'custom'],\n  ];\n  patterns.forEach(([name, value]) => {\n    const option = document.createElement('option'); option.textContent = name; option.value = value; pattern.append(option);\n  });\n  pattern.value = patterns.some(([, value]) => value === settings.backPattern) ? settings.backPattern : 'ribbed';\n  pattern.addEventListener('change', () => {\n    settings.backPattern = pattern.value;\n    saveAndBroadcast(`Back texture: ${pattern.selectedOptions[0]?.textContent ?? ''}`);\n  });\n  patternRow.append(patternLabel, pattern);\n  surfaces.append(patternRow);\n  numberSlider(surfaces, 'Pattern strength', 0, 1, .01, () => settings.backPatternStrength, (v) => { settings.backPatternStrength = v; }, '', DEFAULTS.backPatternStrength);\n\n  const backFileRow = document.createElement('div');\n  backFileRow.className = 'dev-tuning-file';\n  const backFileLabel = document.createElement('label'); backFileLabel.textContent = 'Back image';\n  const backFile = document.createElement('input'); backFile.type = 'file'; backFile.accept = 'image/*';\n  const backClear = document.createElement('button'); backClear.type = 'button'; backClear.className = 'dev-tuning-action'; backClear.textContent = 'Clear';\n  backFile.addEventListener('change', async () => {\n    const selected = backFile.files?.[0];\n    if (!selected) return;\n    if (selected.size > 8_000_000) { setStatus('Back image is over 8 MB.'); backFile.value = ''; return; }\n    setStatus(`Optimizing ${selected.name} for tile backs…`);\n    try {\n      settings.backImage = await optimizedBackImage(selected);\n      settings.backPattern = 'custom';\n      saveAndBroadcast(`Loaded back texture: ${selected.name}`);\n      root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false; syncDevOpenClass();\n    } catch {\n      setStatus('Could not decode/optimize that back image.');\n      backFile.value = '';\n    }\n  });\n  backClear.addEventListener('click', () => {\n    settings.backImage = null;\n    if (settings.backPattern === 'custom') settings.backPattern = DEFAULTS.backPattern;\n    backFile.value = '';\n    saveAndBroadcast('Custom back image cleared.');\n    root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false; syncDevOpenClass();\n  });\n  backFileRow.append(backFileLabel, backFile, backClear);\n  surfaces.append(backFileRow);\n  surfaces.insertAdjacentHTML('beforeend', '<p class=\"dev-tuning-note\">Patterns are generated at runtime and tinted by Back RGB. Custom images are optimized before being stored.</p>');"""
    text = replace_once(text, marker, replacement, "back texture UI")
    return text


patch('client/src/dev-tuning.ts', patch_dev)


# --- table-3d-faces.ts: 2x canvas and a visibly more traditional tile-face set.
def patch_faces(text: str) -> str:
    text = replace_once(
        text,
        """  canvas.width = 160;\n  canvas.height = 216;\n  const ctx = canvas.getContext('2d');\n  if (!ctx) return canvas;\n\n  ctx.fillStyle = back ? '#ffffff' : '#fffdf8';\n  ctx.fillRect(0, 0, canvas.width, canvas.height);""",
        """  const renderScale = 2;\n  canvas.width = 160 * renderScale;\n  canvas.height = 216 * renderScale;\n  const ctx = canvas.getContext('2d');\n  if (!ctx) return canvas;\n  ctx.scale(renderScale, renderScale);\n\n  ctx.fillStyle = back ? '#ffffff' : '#fffefd';\n  ctx.fillRect(0, 0, 160, 216);""",
        "2x face canvas",
    )
    text = replace_regex(
        text,
        r"function drawMan\(ctx: CanvasRenderingContext2D, rank: number, red: boolean\): void \{.*?\n\}",
        """function drawMan(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {\n  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];\n  ctx.save();\n  ctx.textAlign = 'center';\n  ctx.textBaseline = 'middle';\n  ctx.fillStyle = red ? '#c22f2d' : '#18251f';\n  ctx.font = '800 88px \"Noto Serif CJK JP\", \"Yu Mincho\", \"MS Mincho\", serif';\n  ctx.fillText(numerals[rank - 1] ?? String(rank), 80, 70);\n  ctx.fillStyle = '#c5302d';\n  ctx.font = '800 70px \"Noto Serif CJK JP\", \"Yu Mincho\", \"MS Mincho\", serif';\n  ctx.fillText('萬', 80, 158);\n  ctx.restore();\n}""",
        "classic man fronts",
        flags=re.S,
    )
    text = replace_regex(
        text,
        r"function drawPin\(ctx: CanvasRenderingContext2D, rank: number, red: boolean\): void \{.*?\n\}\n\nfunction souLayout",
        """function drawPin(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {\n  const dark = '#18342d';\n  const palette = red ? ['#c9302c'] : ['#276f4f', '#c9302c', '#1d3850'];\n  pinLayout(rank).forEach(([x, y], index) => {\n    const accent = palette[index % palette.length];\n    const radius = rank === 1 ? 37 : 15.5;\n    ctx.save();\n    ctx.translate(x, y);\n    ctx.strokeStyle = dark;\n    ctx.lineWidth = rank === 1 ? 7 : 4.5;\n    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();\n    ctx.strokeStyle = accent;\n    ctx.lineWidth = rank === 1 ? 5 : 3.5;\n    ctx.beginPath(); ctx.arc(0, 0, radius * .68, 0, Math.PI * 2); ctx.stroke();\n    if (rank === 1) {\n      ctx.strokeStyle = dark;\n      ctx.lineWidth = 4;\n      for (let spoke = 0; spoke < 10; spoke += 1) {\n        const a = spoke * Math.PI / 5;\n        ctx.beginPath();\n        ctx.moveTo(Math.cos(a) * radius * .76, Math.sin(a) * radius * .76);\n        ctx.lineTo(Math.cos(a) * radius * .96, Math.sin(a) * radius * .96);\n        ctx.stroke();\n      }\n    }\n    ctx.fillStyle = accent;\n    ctx.beginPath(); ctx.arc(0, 0, radius * .25, 0, Math.PI * 2); ctx.fill();\n    ctx.fillStyle = '#fffefd';\n    ctx.beginPath(); ctx.arc(0, 0, radius * .10, 0, Math.PI * 2); ctx.fill();\n    ctx.restore();\n  });\n}\n\nfunction souLayout""",
        "classic pin fronts",
        flags=re.S,
    )
    text = replace_regex(
        text,
        r"function drawSou\(ctx: CanvasRenderingContext2D, rank: number, red: boolean\): void \{.*?\n\}\s*$",
        """function drawSou(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {\n  if (rank === 1) {\n    // Traditional peacock / bird motif: deliberately bolder than the previous minimalist mark.\n    ctx.save();\n    ctx.translate(80, 108);\n    ctx.strokeStyle = '#1f6846';\n    ctx.fillStyle = '#2b6f93';\n    ctx.lineCap = 'round';\n    ctx.lineJoin = 'round';\n    ctx.lineWidth = 6;\n    ctx.beginPath();\n    ctx.moveTo(-5, 62);\n    ctx.quadraticCurveTo(-12, 15, 3, -22);\n    ctx.stroke();\n    ctx.beginPath();\n    ctx.ellipse(6, -38, 20, 29, .25, 0, Math.PI * 2);\n    ctx.fill();\n    ctx.fillStyle = '#c8322e';\n    ctx.beginPath(); ctx.arc(13, -48, 5.5, 0, Math.PI * 2); ctx.fill();\n    const tails = [[-37, 14], [-28, -7], [-15, -22], [25, -20], [36, 2], [31, 25]];\n    for (const [tx, ty] of tails) {\n      ctx.strokeStyle = '#28714b';\n      ctx.lineWidth = 5;\n      ctx.beginPath();\n      ctx.moveTo(-1, -5);\n      ctx.quadraticCurveTo(tx * .55, ty * .6, tx, ty);\n      ctx.stroke();\n      ctx.fillStyle = '#fffefd';\n      ctx.strokeStyle = '#173c31';\n      ctx.lineWidth = 3;\n      ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();\n      ctx.fillStyle = '#c8322e';\n      ctx.beginPath(); ctx.arc(tx, ty, 3.2, 0, Math.PI * 2); ctx.fill();\n    }\n    ctx.restore();\n    return;\n  }\n\n  const green = '#236b47';\n  souLayout(rank).forEach(([x, y, angle], index) => {\n    const accent = red || (rank === 5 && index === 2) ? '#c8322e' : green;\n    ctx.save();\n    ctx.translate(x, y);\n    ctx.rotate(angle * Math.PI / 180);\n    ctx.strokeStyle = '#173c31';\n    ctx.lineWidth = 2.5;\n    ctx.fillStyle = accent;\n    ctx.beginPath();\n    ctx.roundRect(-9, -25, 18, 50, 8);\n    ctx.fill();\n    ctx.stroke();\n    ctx.fillStyle = '#fffefd';\n    ctx.beginPath(); ctx.roundRect(-7.5, -4, 15, 8, 3); ctx.fill();\n    ctx.strokeStyle = 'rgba(255,255,255,.72)';\n    ctx.lineWidth = 1.8;\n    ctx.beginPath(); ctx.moveTo(-3, -19); ctx.lineTo(-3, 19); ctx.stroke();\n    ctx.restore();\n  });\n}""",
        "classic sou fronts",
        flags=re.S,
    )
    text = text.replace("ctx.font = 'bold 112px Georgia, \"Times New Roman\", serif';", "ctx.font = '800 116px \"Noto Serif CJK JP\", \"Yu Mincho\", \"MS Mincho\", serif';")
    return text


patch('client/src/table-3d-faces.ts', patch_faces)


# --- table-3d.ts: physical IDs, called tile orientation, white opponent fronts, smoothing, neutral light, patterned backs.
def patch_table(text: str) -> str:
    text = replace_once(text, "left: { x: -90, y: 0, z: -90 },", "left: { x: -90, y: 180, z: -90 },", "3d left default y")
    text = replace_once(text, "right: { x: -90, y: 0, z: 90 },", "right: { x: -90, y: 180, z: 90 },", "3d right default y")
    text = replace_once(
        text,
        """    riverTiltJitter: number;\n  };""",
        """    riverTiltJitter: number;\n    meldGap: number;\n    meldRowGap: number;\n    calledTileRotation: number;\n  };""",
        "3d meld tuning type",
    )
    text = replace_once(
        text,
        """  backColor: string;\n  sceneColor: string;\n};""",
        """  backColor: string;\n  backPattern: string;\n  backPatternStrength: number;\n  backImage: string | null;\n  sceneColor: string;\n};""",
        "3d back pattern type",
    )
    text = replace_once(
        text,
        """    riverTiltJitter: .7,\n  },""",
        """    riverTiltJitter: .7,\n    meldGap: .36,\n    meldRowGap: .48,\n    calledTileRotation: 90,\n  },""",
        "3d meld defaults",
    )
    text = replace_once(
        text,
        """  backColor: '#315c49',\n  sceneColor: '#071b13',""",
        """  backColor: '#315c49',\n  backPattern: 'ribbed',\n  backPatternStrength: .48,\n  backImage: null,\n  sceneColor: '#071b13',""",
        "3d back defaults",
    )
    text = replace_once(
        text,
        """  tileId: number | null;\n  element: HTMLElement | null;""",
        """  tileId: number | null;\n  called?: boolean;\n  calledFrom?: number | null;\n  element: HTMLElement | null;""",
        "tile spec called metadata",
    )
    text = replace_once(
        text,
        """  tableTexture: any | null;\n  tableTextureSource: string | null;""",
        """  tableTexture: any | null;\n  tableTextureSource: string | null;\n  backTexture: any | null;\n  backTextureSource: string | null;""",
        "runtime back texture fields",
    )
    text = replace_once(
        text,
        """      riverTiltJitter: finiteNumber(raw.tiles?.riverTiltJitter, DEFAULT_DEV_TUNING.tiles.riverTiltJitter),\n    },""",
        """      riverTiltJitter: finiteNumber(raw.tiles?.riverTiltJitter, DEFAULT_DEV_TUNING.tiles.riverTiltJitter),\n      meldGap: finiteNumber(raw.tiles?.meldGap, DEFAULT_DEV_TUNING.tiles.meldGap),\n      meldRowGap: finiteNumber(raw.tiles?.meldRowGap, DEFAULT_DEV_TUNING.tiles.meldRowGap),\n      calledTileRotation: finiteNumber(raw.tiles?.calledTileRotation, DEFAULT_DEV_TUNING.tiles.calledTileRotation),\n    },""",
        "3d meld loader",
    )
    text = replace_once(
        text,
        """    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULT_DEV_TUNING.backColor,\n    sceneColor: typeof raw.sceneColor === 'string' ? raw.sceneColor : DEFAULT_DEV_TUNING.sceneColor,""",
        """    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULT_DEV_TUNING.backColor,\n    backPattern: typeof raw.backPattern === 'string' ? raw.backPattern : DEFAULT_DEV_TUNING.backPattern,\n    backPatternStrength: finiteNumber(raw.backPatternStrength, DEFAULT_DEV_TUNING.backPatternStrength),\n    backImage: typeof raw.backImage === 'string' ? raw.backImage : null,\n    sceneColor: typeof raw.sceneColor === 'string' ? raw.sceneColor : DEFAULT_DEV_TUNING.sceneColor,""",
        "3d back loader",
    )
    text = replace_once(
        text,
        """  if (Math.abs(parsed.tiles.riverRowGap - .55) < .0001) parsed.tiles.riverRowGap = .60;\n  devTuningCache = parsed;""",
        """  if (Math.abs(parsed.tiles.riverRowGap - .55) < .0001) parsed.tiles.riverRowGap = .60;\n  if (parsed.left.x === -90 && parsed.left.z === -90 && parsed.left.y === 0) parsed.left.y = 180;\n  if (parsed.right.x === -90 && parsed.right.z === 90 && parsed.right.y === 0) parsed.right.y = 180;\n  devTuningCache = parsed;""",
        "3d rotation migration",
    )
    # Tight, edge-hugging meld layout + rotated called tile.
    text = replace_regex(
        text,
        r"  \} else \{\n    const row = Math\.floor\(spec\.index / 8\);\n    const col = spec\.index % 8;\n    transform\.scale = \.80 \* tuning\.tiles\.meldScale;\n    // Every player's open sets start in that player's lower-right corner and grow away from it\.\n    if \(spec\.side === 'bottom'\) \{.*?\n    \}\n  \}\n\n  return humanizeTransform",
        """  } else {\n    const row = Math.floor(spec.index / 8);\n    const col = spec.index % 8;\n    const gap = tuning.tiles.meldGap;\n    const rowGap = tuning.tiles.meldRowGap;\n    transform.scale = .80 * tuning.tiles.meldScale;\n    // Open sets hug the player's lower-right rail. Tiles within a meld are nearly touching.\n    if (spec.side === 'bottom') {\n      transform.x = 5.67 - col * gap;\n      transform.z = 4.48 - row * rowGap;\n    } else if (spec.side === 'top') {\n      transform.x = -5.67 + col * gap;\n      transform.z = -4.48 + row * rowGap;\n      transform.yaw = Math.PI;\n    } else if (spec.side === 'left') {\n      transform.x = -5.67 + row * rowGap;\n      transform.z = 4.48 - col * gap;\n      transform.yaw = Math.PI / 2;\n    } else {\n      transform.x = 5.67 - row * rowGap;\n      transform.z = -4.48 + col * gap;\n      transform.yaw = -Math.PI / 2;\n    }\n    if (spec.called) {\n      transform.yaw += radians(tuning.tiles.calledTileRotation);\n      transform.y += .012;\n    }\n  }\n\n  return humanizeTransform""",
        "compact called meld layout",
        flags=re.S,
    )
    # Geometry quality and back cap proportions.
    text = text.replace("curveSegments: 4,\n    bevelEnabled: true,\n    bevelSegments: 2,", "curveSegments: 10,\n    bevelEnabled: true,\n    bevelSegments: 4,", 1)
    text = replace_once(text, "const width = .448;\n  const depth = .588;\n  const height = .040;", "const width = .430;\n  const depth = .570;\n  const height = .052;", "back shell proportions")
    text = text.replace("depth: height, steps: 1, curveSegments: 6, bevelEnabled: true,\n    bevelSegments: 2,", "depth: height, steps: 1, curveSegments: 10, bevelEnabled: true,\n    bevelSegments: 4,", 1)
    text = replace_once(text, "const geometry = new THREE.ShapeGeometry(shape, 8);", "const geometry = new THREE.ShapeGeometry(shape, 14);", "face smoothing")
    text = replace_once(text, "if (back) return rt.backMaterial;", "if (back) return rt.ivoryMaterial;", "white concealed front")
    # Gather exact physical IDs and called meld metadata.
    text = replace_once(
        text,
        """      rack.forEach((element, index) => {\n        specs.push({\n          key: `concealed:${player}:${index}`,""",
        """      rack.forEach((element, index) => {\n        const tileId = elementTileId(element);\n        specs.push({\n          key: tileId === null ? `concealed:${player}:${index}` : `tile:${tileId}`,""",
        "rack physical key",
    )
    text = replace_once(
        text,
        """          drawn: false,\n          latest: false,\n          tileId: null,""",
        """          drawn: element.classList.contains('tile-drawn'),\n          latest: false,\n          tileId,""",
        "rack drawn metadata",
    )
    text = replace_once(
        text,
        """        tileId,\n        element,\n      });\n    });\n  }\n\n  const handElements""",
        """        tileId,\n        called: element.classList.contains('tile-meld-called'),\n        calledFrom: element.dataset.calledFrom === undefined ? null : Number(element.dataset.calledFrom),\n        element,\n      });\n    });\n  }\n\n  const handElements""",
        "meld called metadata",
    )
    # Renderer quality / neutral lighting.
    text = replace_once(text, "renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));", "renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));", "pixel ratio")
    text = replace_once(text, "scene.add(new THREE.HemisphereLight(0xf3ead7, 0x0b1811, 1.35));", "scene.add(new THREE.HemisphereLight(0xf8fbff, 0x0d1712, 1.28));", "neutral hemisphere")
    text = replace_once(text, "const key = new THREE.DirectionalLight(0xffefd2, 2.3);", "const key = new THREE.DirectionalLight(0xffffff, 2.18);", "neutral key")
    text = replace_once(text, "const fill = new THREE.PointLight(0x79ae92, .75, 17, 2);", "const fill = new THREE.PointLight(0x9dc5b0, .58, 17, 2);", "neutral fill")
    # Replace back material initialization; applyDevTuning will install a procedural/custom map.
    text = replace_once(
        text,
        """  const backTexture = new THREE.CanvasTexture(createFaceCanvas(null, true, 'classic'));\n  backTexture.colorSpace = THREE.SRGBColorSpace;\n  const backMaterial = new THREE.MeshStandardMaterial({\n    map: backTexture, color: tuning.backColor, roughness: .58, metalness: 0,\n    side: THREE.DoubleSide,\n  });""",
        """  const backMaterial = new THREE.MeshStandardMaterial({\n    color: tuning.backColor, roughness: .62, metalness: 0,\n    side: THREE.DoubleSide,\n  });""",
        "back material init",
    )
    text = replace_once(
        text,
        """    tableTexture: null,\n    tableTextureSource: null,\n    faceMaterials:""",
        """    tableTexture: null,\n    tableTextureSource: null,\n    backTexture: null,\n    backTextureSource: null,\n    faceMaterials:""",
        "runtime back texture init",
    )
    # Insert procedural back pattern functions before applyDevTuning.
    insert_marker = """function applyDevTuning(rt: TableRuntime): void {"""
    back_helpers = r'''function createBackPatternCanvas(pattern: string, strength: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const s = Math.max(0, Math.min(1, strength));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (pattern === 'solid') return canvas;

  const dark = (alpha: number) => `rgba(20,28,24,${(alpha * s).toFixed(3)})`;
  const light = (alpha: number) => `rgba(255,255,255,${(alpha * s).toFixed(3)})`;
  ctx.lineCap = 'round';

  if (pattern === 'ribbed') {
    for (let x = 10; x < canvas.width; x += 14) {
      ctx.strokeStyle = dark(.26); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, canvas.height - 5); ctx.stroke();
      ctx.strokeStyle = light(.22); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + 4, 5); ctx.lineTo(x + 4, canvas.height - 5); ctx.stroke();
    }
  } else if (pattern === 'woven') {
    ctx.lineWidth = 2;
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += 18) {
      ctx.strokeStyle = dark(.20); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + canvas.height, canvas.height); ctx.stroke();
      ctx.strokeStyle = light(.18); ctx.beginPath(); ctx.moveTo(x + 8, 0); ctx.lineTo(x + canvas.height + 8, canvas.height); ctx.stroke();
    }
    for (let x = 0; x < canvas.width + canvas.height; x += 22) {
      ctx.strokeStyle = dark(.12); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - canvas.height, canvas.height); ctx.stroke();
    }
  } else if (pattern === 'diamond' || pattern === 'classic') {
    ctx.lineWidth = pattern === 'classic' ? 3 : 2;
    const step = pattern === 'classic' ? 34 : 28;
    for (let y = -step; y < canvas.height + step; y += step) {
      for (let x = -step; x < canvas.width + step; x += step) {
        ctx.strokeStyle = dark(pattern === 'classic' ? .24 : .18);
        ctx.beginPath();
        ctx.moveTo(x, y + step / 2); ctx.lineTo(x + step / 2, y); ctx.lineTo(x + step, y + step / 2); ctx.lineTo(x + step / 2, y + step); ctx.closePath();
        ctx.stroke();
      }
    }
    if (pattern === 'classic') {
      ctx.strokeStyle = dark(.38); ctx.lineWidth = 6; ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
      ctx.strokeStyle = light(.25); ctx.lineWidth = 2; ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
    }
  } else if (pattern === 'waves') {
    ctx.lineWidth = 3;
    for (let y = 18; y < canvas.height; y += 24) {
      ctx.strokeStyle = dark(.22);
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 8) {
        const yy = y + Math.sin((x / 38) * Math.PI * 2) * 5;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
  return canvas;
}

function backTextureKey(tuning: DevTuning): string {
  if (tuning.backPattern === 'custom' && tuning.backImage) {
    return `custom:${tuning.backImage.length}:${tuning.backImage.slice(-48)}`;
  }
  return `pattern:${tuning.backPattern}:${tuning.backPatternStrength.toFixed(3)}`;
}

function configureBackTexture(rt: TableRuntime, texture: any): void {
  texture.colorSpace = rt.THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, rt.renderer.capabilities.getMaxAnisotropy());
  texture.generateMipmaps = true;
  texture.minFilter = rt.THREE.LinearMipmapLinearFilter;
  texture.magFilter = rt.THREE.LinearFilter;
  rt.backTexture = texture;
  rt.backMaterial.map = texture;
  rt.backMaterial.needsUpdate = true;
}

function syncBackTexture(rt: TableRuntime, tuning: DevTuning): void {
  const key = backTextureKey(tuning);
  if (rt.backTextureSource === key) return;
  rt.backTextureSource = key;
  rt.backTexture?.dispose?.();
  rt.backTexture = null;
  rt.backMaterial.map = null;
  rt.backMaterial.needsUpdate = true;

  if (tuning.backPattern === 'custom' && tuning.backImage) {
    new rt.THREE.TextureLoader().load(tuning.backImage, (texture: any) => {
      if (rt.disposed || rt.backTextureSource !== key) { texture.dispose(); return; }
      configureBackTexture(rt, texture);
    });
    return;
  }
  const texture = new rt.THREE.CanvasTexture(createBackPatternCanvas(tuning.backPattern, tuning.backPatternStrength));
  configureBackTexture(rt, texture);
}

'''
    text = replace_once(text, insert_marker, back_helpers + insert_marker, "back pattern helpers")
    text = replace_once(
        text,
        """  rt.backMaterial.color.set(tuning.backColor);\n  rt.backShellMaterial.color.set(tuning.backColor);""",
        """  rt.backMaterial.color.set(tuning.backColor);\n  rt.backShellMaterial.color.set(tuning.backColor);\n  syncBackTexture(rt, tuning);""",
        "sync back texture",
    )
    text = replace_once(
        text,
        """  rt.tableTexture?.dispose?.();\n  rt.backMaterial.map?.dispose?.();\n  rt.backMaterial.dispose();""",
        """  rt.tableTexture?.dispose?.();\n  rt.backTexture?.dispose?.();\n  rt.backMaterial.dispose();""",
        "dispose back texture",
    )
    return text


patch('client/src/table-3d.ts', patch_table)
