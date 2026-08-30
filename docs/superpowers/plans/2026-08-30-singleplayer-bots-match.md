# Plan 9 — Hanchan, boty i single-player

Data: 2026-08-30
Priorytet: mechanika → boty → single-player. Multiplayer/PR #6 wstrzymany.

## Cel

Zamknąć grywalny rdzeń single-player bez UI 3D: pełny hanchan East-South, automatyczne przechodzenie między rozdaniami, jeden człowiek + 3 boty oraz API, na którym później oprze się klient.

## Rulings V1

Profil meczu pozostaje Tenhou-like i zgodny z obecnym core spec:
- 4 graczy, start 25 000, target 30 000.
- East 1 → South 4; jeśli po South 4 brak 30 000, wejście w West round, maksymalnie do West 4.
- Tobi: wynik ujemny kończy mecz; dokładnie 0 nie kończy.
- Dealer renchan po własnej wygranej albo po exhaustive draw, jeśli dealer jest tenpai.
- Double/triple Ron: jeśli dealer jest wśród zwycięzców, renchan.
- Nagashi Mangan nie zmienia kryterium renchan — dealer powtarza tylko jeśli jest tenpai, zgodnie z profilem Tenhou.
- Honba: +1 po renchan i po exhaustive draw; reset do 0 po wygranej niedealera.
- South 4: automatyczne agari-yame / tenpai-yame tylko gdy last dealer kończy rozdanie jako lider i spełnia target 30 000.
- West: sudden death po rozdaniu, gdy dealership nie jest utrzymany i ktoś ma >= 30 000; dealer repeat ma pierwszeństwo.
- Po West 4 mecz kończy się przy pierwszej rotacji dealera, nawet jeśli target nie został osiągnięty.
- Niewybrane riichi sticks przy końcu meczu trafiają do gracza na 1. miejscu.
- Remisy punktowe rozstrzyga kolejność miejsc z East 1: initial dealer, potem kolejne seaty.
- Rzadkie abortive draws pozostają poza V1 zgodnie z core spec.

## Część A — Match engine

Nowy `shared/src/engine/match/`:
- `MatchState`, `MatchResult`, ranking/placements.
- `createMatch(rng, options)` tworzy East 1.
- `advanceMatch(state, rng)` działa tylko po `round.phase.kind === 'ended'`.
- Przenosi punkty, dealer, honba, riichi sticks i prevailing wind do kolejnego `createRound`.
- Rozpoznaje renchan, tobi, all-last, West sudden death i max West 4.
- Przy końcu rozdziela pozostałe riichi sticks i zwraca końcową kolejność.

## Część B — Shanten dla otwartych rąk

Rozszerzyć kalkulator shanten bez łamania starego API:
- `standardShantenWithFixedMelds(concealed, fixedMeldCount)`.
- `structuralShanten(concealed, fixedMeldCount)` — przy fixed melds > 0 bierze tylko standard hand; przy 0 uwzględnia standard/Chiitoitsu/Kokushi.
- Waliduje fizyczny rozmiar concealed: `13 - 3 * fixedMeldCount` w stanie pomiędzy drawami.

To jest baza pod AI po Chi/Pon/Kan.

## Część C — Bot V1

Nowy `shared/src/engine/bot/`.

Bot nie oszukuje: decyzja dostaje pełny `RoundState`, ale heurystyki używają tylko własnej ręki + informacji publicznych.

Priorytety:
1. Tsumo/Ron zawsze.
2. Draw zawsze.
3. Riichi przy legalnym tenpai; wybór discardu przez evaluator.
4. Discard minimalizuje structural shanten.
5. Tie-break: zachowanie aka/dora, par i połączeń 2-sided; odrzucanie izolowanych honorów/terminali.
6. Obrona: przeciw Riichi silna preferencja dla genbutsu z discardów przeciwnika.
7. Pon/Chi tylko gdy po obowiązkowym discardzie poprawia shanten; value-honor Pon może być akceptowany przy braku pogorszenia.
8. Daiminkan/Ankan/Shouminkan konserwatywnie: legalność z engine, brak pogorszenia struktury i brak oczywistego ryzyka przeciw Riichi.
9. Bot deterministyczny dla tej samej pozycji — ważne dla testów/replay.

API: `chooseBotDecision(state, player)` zwraca `RoundAction | pass`.

## Część D — Single-player orchestrator

Nowy `shared/src/engine/single/`:
- `createSingleGame(seed, humanSeat)`.
- 3 pozostałe seaty są botami.
- `driveSingleGame` automatycznie wykonuje drawy bez decyzji i wszystkie tury botów.
- Zatrzymuje się tylko przy realnej decyzji człowieka, końcu rozdania lub końcu meczu.
- Reakcje: jeśli człowiek ma Ron/Pon/Chi/Daiminkan, najpierw dostaje prompt; po jego decyzji boty odpowiadają i engine dostaje jedno `resolve-reactions`.
- Jeśli człowiek nie ma reakcji, boty + resolve wykonywane są automatycznie.
- Koniec rozdania wymaga jawnego `continueSingleGame`, żeby przyszły UI mógł pokazać tabelę wyniku.
- API zwraca eventy i ruchy botów do przyszłego logu/animacji.
- Twardy safety cap akcji chroni przed pętlą AI.

## Testy kontraktowe

- minimum 8 rozdanych rąk hanchana bez renchan: East1…South4.
- dealer win / dealer tenpai → renchan i honba+1.
- nondealer win → dealer rotation, honba reset.
- exhaustive dealer noten → rotation + honba+1.
- tobi <0, ale nie przy 0.
- South4 target, agari-yame/tenpai-yame.
- West entry/sudden death/max West4.
- leftover riichi sticks i tie-break placements.
- open-hand shanten 1/2/3 fixed melds.
- bot zawsze bierze legalne Tsumo/Ron.
- bot nie łamie Riichi tsumogiri.
- bot preferuje niższy shanten i genbutsu pod Riichi.
- bot nie robi calla pogarszającego shanten.
- single game zatrzymuje się na human prompt i nie wykonuje ruchu za człowieka.
- bot-only reakcje poprawnie rozwiązują Ron > Pon > Chi przez istniejący reducer.
- setki deterministycznych bot-vs-bot rozdań bez nielegalnej akcji/crasha jako smoke test.

## Nie teraz

- WebSocket / matchmaking / reconnect.
- 3D/UI/audio.
- Monte Carlo / ML AI.
- Sanma.
- Abortive draws wyłączone w core spec.
