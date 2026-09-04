from pathlib import Path

root = Path(__file__).resolve().parents[1]

def patch(rel: str, old: str, new: str) -> None:
    path = root / rel
    text = path.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'anchor missing in {rel}: {old[:120]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

# With immediate Daiminkan Dora, the subsequent chained Ankan reveals exactly one NEW indicator;
# the Daiminkan indicator was already revealed in the prior action.
patch(
    'shared/src/engine/rules/kan.test.ts',
    "expect(chained.events.filter((event) => event.type === 'DoraIndicatorRevealed')).toHaveLength(2);",
    "expect(chained.events.filter((event) => event.type === 'DoraIndicatorRevealed')).toHaveLength(1);",
)

# A robbed Shouminkan never completes, so it must not reveal its Dora indicator.
patch(
    'shared/src/engine/rules/chankan.test.ts',
    "    expect(resolved.state.phase.result.type).toBe('ron');\n    expect(resolved.state.players[0].melds[0].type).toBe('triplet');\n    expect(resolved.state.wall.doraIndicators).toHaveLength(2);",
    "    expect(resolved.state.phase.result.type).toBe('ron');\n    expect(resolved.state.players[0].melds[0].type).toBe('triplet');\n    expect(resolved.state.wall.doraIndicators).toHaveLength(1);",
)

# A completed Shouminkan now reveals immediately, before the Rinshan draw.
patch(
    'shared/src/engine/rules/chankan.test.ts',
    "      pendingKanDora: false,\n    });\n    expect(resolved.state.wall.doraIndicators).toHaveLength(1);",
    "      pendingKanDora: false,\n    });\n    expect(resolved.state.wall.doraIndicators).toHaveLength(2);",
)

# Keep the old 'Meld row gap' tuning value useful: it now controls spacing between complete
# 3/4-tile meld groups instead of an obsolete wrap-to-second-row distance.
patch(
    'client/src/table-3d.ts',
    "    const groupStride = Math.max(1.18, gap * 4 + .14);",
    "    const groupGap = tuning.tiles.meldRowGap;\n    const groupStride = Math.max(1.18, gap * 4 + groupGap);",
)
patch(
    'client/src/dev-tuning.ts',
    "numberSlider(tileSection, 'Meld row gap', .38, .70, .01, () => settings.tiles.meldRowGap, (v) => { settings.tiles.meldRowGap = v; }, '', DEFAULTS.tiles.meldRowGap);",
    "numberSlider(tileSection, 'Meld group gap', .10, .70, .01, () => settings.tiles.meldRowGap, (v) => { settings.tiles.meldRowGap = v; }, '', DEFAULTS.tiles.meldRowGap);",
)
