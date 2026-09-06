from pathlib import Path

path = Path('client/src/main.ts')
source = path.read_text(encoding='utf-8')

replacements = [
    (
        '''      <div class="opponent-card">
        ${playerStatusMarkup(player, state)}
        <div class="opponent-hand" aria-label="${concealedCount} concealed tiles">${backs}</div>
        <div class="meld-row">${melds}</div>
      </div>
      <div class="discard-river">${discards}</div>''',
        '''      <div class="opponent-card">
        ${playerStatusMarkup(player, state)}
        <div class="opponent-hand" aria-label="${concealedCount} concealed tiles">${backs}</div>
      </div>
      <div class="meld-row">${melds}</div>
      <div class="discard-river">${discards}</div>''',
    ),
    (
        '''      <div class="human-card">
        ${playerStatusMarkup(human, state)}
        <div class="human-hand" id="human-hand">${humanHandMarkup()}</div>
        <div class="meld-row human-melds">${melds}</div>
      </div>''',
        '''      <div class="human-card">
        ${playerStatusMarkup(human, state)}
        <div class="human-hand" id="human-hand">${humanHandMarkup()}</div>
      </div>
      <div class="meld-row human-melds">${melds}</div>''',
    ),
]

for before, after in replacements:
    if before not in source:
        raise SystemExit(f'Expected main.ts block not found:\n{before}')
    source = source.replace(before, after, 1)

path.write_text(source, encoding='utf-8')
