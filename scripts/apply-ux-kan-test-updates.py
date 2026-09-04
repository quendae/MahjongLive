from pathlib import Path

root = Path(__file__).resolve().parents[1]

def patch_file(rel: str, replacements: list[tuple[str, str]]) -> None:
    path = root / rel
    text = path.read_text(encoding='utf-8')
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'anchor missing in {rel}: {old[:80]!r}')
        text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')

patch_file('shared/src/engine/rules/kan.test.ts', [
    ("describe('Daiminkan delayed Kan-Dora', () => {", "describe('Daiminkan immediate Kan-Dora', () => {"),
    ("it('draws Rinshan immediately but reveals the new indicator only when that player discards', () => {", "it('reveals the new indicator when the Kan completes, before the Rinshan discard', () => {"),
    ("    expect(resolved.state.wall.doraIndicators).toHaveLength(1);\n    expect(resolved.state.phase.pendingKanDora).toBe(true);\n    const drawnId = resolved.state.phase.drawnTileId!;\n    const discard = applyAction(resolved.state, { type: 'discard', player: 1, tileId: drawnId });\n    expect(discard.ok).toBe(true);\n    if (!discard.ok) return;\n    expect(discard.state.wall.doraIndicators).toHaveLength(2);\n    expect(discard.events.some((event) => event.type === 'DoraIndicatorRevealed')).toBe(true);",
     "    expect(resolved.state.wall.doraIndicators).toHaveLength(2);\n    expect(resolved.state.phase.pendingKanDora).toBe(false);\n    expect(resolved.events.some((event) => event.type === 'DoraIndicatorRevealed')).toBe(true);\n    const drawnId = resolved.state.phase.drawnTileId!;\n    const discard = applyAction(resolved.state, { type: 'discard', player: 1, tileId: drawnId });\n    expect(discard.ok).toBe(true);\n    if (!discard.ok) return;\n    expect(discard.state.wall.doraIndicators).toHaveLength(2);\n    expect(discard.events.some((event) => event.type === 'DoraIndicatorRevealed')).toBe(false);"),
    ("it('does not reveal the delayed Kan-Dora when the caller wins immediately on Rinshan', () => {", "it('keeps the immediately revealed Kan-Dora active for a Rinshan win', () => {"),
    ("    expect(resolved.state.wall.doraIndicators).toHaveLength(1);\n    expect(resolved.state.phase.pendingKanDora).toBe(true);\n    expect(getLegalActions(resolved.state, 1).some((action) => action.type === 'tsumo')).toBe(true);",
     "    expect(resolved.state.wall.doraIndicators).toHaveLength(2);\n    expect(resolved.state.phase.pendingKanDora).toBe(false);\n    expect(getLegalActions(resolved.state, 1).some((action) => action.type === 'tsumo')).toBe(true);"),
    ("    expect(win.state.wall.doraIndicators).toHaveLength(1);", "    expect(win.state.wall.doraIndicators).toHaveLength(2);"),
    ("it('flushes a previous delayed indicator before a chained Ankan, then reveals the Ankan Dora immediately', () => {", "it('keeps immediate Daiminkan Dora active and adds the chained Ankan Dora', () => {"),
    ("    expect(firstKan.state.wall.doraIndicators).toHaveLength(1);\n    expect(firstKan.state.phase.pendingKanDora).toBe(true);",
     "    expect(firstKan.state.wall.doraIndicators).toHaveLength(2);\n    expect(firstKan.state.phase.pendingKanDora).toBe(false);"),
])

patch_file('shared/src/engine/rules/chankan.test.ts', [
    ("      pendingKanDora: true,", "      pendingKanDora: false,"),
    ("    expect(resolved.state.wall.doraIndicators).toHaveLength(1);", "    expect(resolved.state.wall.doraIndicators).toHaveLength(2);"),
])
