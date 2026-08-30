# Plan 10 — Single-player web client

Data: 2026-08-30
Priorytet: grywalny single-player przed multiplayerem.

## Cel

Dostarczyć pierwszy rzeczywiście grywalny klient przeglądarkowy oparty wyłącznie na produkcyjnym `@mahjong-live/shared/single`. UI nie implementuje zasad samodzielnie — wszystkie legalne akcje, scoring, reakcje i przejścia rund pochodzą z engine.

## Stack

- Vanilla TypeScript + Vite.
- Brak frameworka UI i brak serwera.
- Jeden lokalny gracz + 3 boty.
- Stan zapisywany jako JSON w `localStorage`.

## Zakres

- Stół 4-osobowy z perspektywą człowieka na dole.
- Punkty, seat wind, Riichi, dealer, honba, riichi sticks i liczba kafli w wall.
- Zakryte ręce botów; widoczne tylko liczby kafli, meldy i discardy.
- Ręka człowieka z fizycznymi kaflami i oznaczeniem dobranego kafla.
- Dora indicators.
- Akcje: discard, Riichi-discard, Tsumo, Ron, Chi, Pon, Daiminkan, Ankan, Shouminkan, Pass.
- Wybór konkretnej kombinacji przy wielu legalnych wariantach call/Kan.
- Log zdarzeń produkowany z eventów/trace single controllera.
- Ekran końca rozdania z yaku/han/fu/płatnością kiedy dotyczy.
- Ekran końca meczu z rankingiem.
- New Game, Save/Resume, reset zapisu.
- Responsive desktop/tablet/phone landscape/portrait.

## Zasady architektury

1. Klient nigdy nie wywołuje reducerowych akcji, których nie podał `HumanPrompt.legalActions`.
2. Ręce botów nie są renderowane mimo że lokalny state technicznie je zawiera.
3. Po każdej udanej decyzji zapisujemy wyłącznie serializowalny `SingleGameState`.
4. Wznowienie używa `driveSingleGame(restoredState)`, a nie rekonstruuje promptu po stronie UI.
5. Multiplayer i server pozostają poza Planem 10.
