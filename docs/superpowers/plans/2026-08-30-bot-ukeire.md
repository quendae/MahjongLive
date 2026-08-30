# Plan 11 — Bot ukeire improvement

Data: 2026-08-30
Priorytet: jakość botów przed multiplayerem.

## Cel

Wzmocnić deterministycznego bota bez używania ukrytych informacji. Przy decyzjach blisko tenpai bot ma rozróżniać discardy o identycznym shanten na podstawie realnej liczby efektywnych kafli (ukeire).

## Rulings

- Ukeire korzysta wyłącznie z własnej concealed hand i informacji publicznych: discardów, meldów oraz odkrytych Dora indicators.
- Nie wolno czytać cudzych concealed hands ani zawartości live/dead wall.
- Called discard występujący także w meldzie jest jednym fizycznym kaflem i musi być deduplikowany po `tile.id`.
- Ukeire jest liczone dokładnie dla 0–1 shanten; wcześniejsza faza ręki pozostaje przy tańszej heurystyce strukturalnej, aby pełne symulacje hanchana pozostały szybkie.
- Shanten dostaje osobny wariant `structuralShantenAfterDraw`, gdzie complete shape = -1. Pozwala ocenić 34 typy drawów bez zagnieżdżonego testowania wszystkich kolejnych discardów.
- Obrona genbutsu ma nadal pierwszeństwo podczas pełnego folda.

## Walidacja

- closed i open post-draw shanten,
- szeroki wait vs tanki przy tym samym shanten,
- deduplikacja called discard/meld,
- istniejące bot simulations i pełny hanchan muszą pozostać zielone,
- kontrola czasu pełnego suite po dodaniu ukeire.
