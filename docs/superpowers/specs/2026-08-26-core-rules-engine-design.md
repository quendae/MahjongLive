# Silnik Zasad Riichi (`/shared/engine`) — Design Spec

Data: 2026-08-26
Sub-projekt: 1 z 6 (Faza 1: Singleplayer & Core Gameplay)
Status: zatwierdzony do implementacji

## 1. Kontekst

Mahjong Live! to konkurencja dla Tenhou i Mahjong Soul — pełne 3D, bez gacha. Pełny
kontekst projektu: patrz dokument źródłowy dostarczony przez użytkownika (Game Design
Document, sekcje 1-6).

Projekt podzielono na 6 sub-projektów budowanych sekwencyjnie w ramach Fazy 1:
1. **Silnik zasad Riichi** (ten dokument)
2. Backend / serwer autorytatywny
3. Boty AI (FSM + heurystyka Shanten)
4. Frontend 3D (Three.js)
5. UI (Vanilla JS/DOM)
6. Audio

Ten spec dotyczy wyłącznie sub-projektu 1.

## 2. Cel i zakres

Zbudować kompletną, czystą logikę reguł Riichi Mahjong jako moduł izomorficzny —
używany identycznie przez serwer (pełna widoczność stanu) i klienta (widoczność
ograniczona do wiedzy publicznej + własnej ręki). Moduł nie zawiera żadnego I/O:
brak sieci, brak renderowania, brak zegara systemowego.

### W zakresie
- Reprezentacja kafelków, ściany, ręki
- Dekompozycja i walidacja układów (w tym kształty specjalne: Chiitoitsu, Kokushi)
- Pełna standardowa lista Yaku (~40, włącznie z Yakuman)
- Pełny system Dora: indicator, kan-dora, ura-dora, aka-dora (czerwone piątki)
- Kalkulator Fu / Han / punktów (w tym Honba, riichi sticks, podział Tsumo oya/ko)
- Kalkulator Shanten / Tenpai (reużywany później przez AI w sub-projekcie 3)
- Furiten (tymczasowy i stały)
- Pełna mechanika Kan: Ankan, Minkan, Kakan, Rinshan Kaihou, Chankan, kan-dora
- Maszyna stanów rundy: kolejność tur, legalne akcje, priorytet wywołań
  Pon/Chi/Kan/Ron, warunki zakończenia rundy (Ryuukyoku, tenpai payments,
  Nagashi Mangan)

### Poza zakresem (świadomie, na start)
- **Sanma (3 graczy)** — dodane później jako rozszerzenie przez Strategy Pattern,
  po ustabilizowaniu wariantu 4-osobowego.
- **Konfigurowalny RuleSet** — reguły są zahardkodowane (patrz sekcja 5), nie
  parametryzowane. Refaktor na konfigurowalność dopiero gdy multiplayer (Faza 2)
  realnie tego zażąda (różne pokoje z różnymi regułami).
- **Rzadkie reguły specjalne** — zgodnie z oryginalnym dokumentem, pomijamy
  Kyuushu Kyuuhai i analogiczne rzadkie przerwania rundy (Suucha Riichi, Suufon
  Renda, Suukaikan). Można dodać w przyszłości bez zmiany architektury.
- Sieć, renderowanie, AI, audio — osobne sub-projekty.

## 3. Stack technologiczny (decyzja dla całego projektu)

- **TypeScript** — w całym kodzie, szczególnie `/shared`, ze względu na gęstość
  niezmienników domenowych (typy kafelków, struktury stanu).
- **Vitest** — test runner, natywne wsparcie ESM/TS, jedne testy odpalane i pod
  Node (serwer), i w symulacji przeglądarki (klient).
- **pnpm workspaces** — monorepo: `/shared`, `/server`, `/client`.
- **Vite** — bundler/dev server klienta (dotyczy sub-projektu 4+, nie tego spec-a).
- Klient: przeglądarka na początku; wrapper (Electron) dopiero na samym końcu
  projektu, jako pakowanie gotowej aplikacji webowej.

## 4. Architektura

Wzorzec: **czysty reducer**, bez efektów ubocznych.

```
applyAction(state: GameState, action: Action): { state: GameState; events: GameEvent[] }
```

Konsument (backend w sub-projekcie 2) trzyma `GameState` i woła `applyAction` na
każdą akcję gracza (discard, call, riichi, itd.). Zwrócone `events[]` pozwalają
konsumentowi zdecydować, co i komu wysłać (np. serwer filtruje ukryte informacje
przed wysłaniem do klientów).

### Struktura modułów

```
/shared/engine
  /tiles      — typy kafelków, porównania, flagi aka-dora
  /wall       — budowa i tasowanie ściany (seedowany PRNG)
  /hand       — dekompozycja ręki, w tym kształty specjalne
  /yaku       — detektory Yaku jako niezależne funkcje
  /scoring    — Fu, Han→punkty, podział Tsumo, Honba, sticks
  /shanten    — kalkulator odległości do Tenpai
  /rules      — maszyna stanów rundy (tury, wywołania, Furiten, zakończenie)
```

Każdy moduł ma jawny interfejs wejście/wyjście i jest testowalny w izolacji od
reszty silnika.

### Kluczowe typy danych

- `Tile` — sformalizowany typ kafelka (suit, rank, isRed dla aka-dora, isAka flag)
- `GameState` — pełny stan rundy: ściana, ręce (per gracz), odrzucone kafelki,
  melds, dora indicators, riichi flags, licznik honba, pozycja rozdającego
- `Action` — dyskryminowana unia: `Discard`, `Call` (Pon/Chi/Kan), `Riichi`,
  `Tsumo`, `Ron`, `KyuushuKyuuhaiSkip` (nie dotyczy — poza zakresem, patrz sekcja 2)
- `GameEvent` — dyskryminowana unia zdarzeń wynikowych: `TileDiscarded`,
  `CallMade`, `RiichiDeclared`, `HandCompleted` (ze szczegółami punktacji),
  `RoundEnded` (Ryuukyoku / Tsumo / Ron / abortive)

## 5. Zahardkodowany zestaw reguł (V1 RuleSet)

Zgodnie z decyzją o braku konfigurowalności, poniższe warianty są ustalone na
sztywno jako wartości domyślne (zbliżone do ogólnych pokoi Tenhou — główny punkt
odniesienia z dokumentu źródłowego):

| Reguła | Wartość |
|---|---|
| Kuitan (open tanyao) | dozwolony |
| Atozuke (yaku tylko z wygrywającego kafelka) | dozwolony |
| Wielokrotny Ron | dozwolony (double/triple ron), bez "head bump" |
| Nagashi Mangan | włączony |
| Kiriage Mangan (zaokrąglenie 4han30fu/3han60fu do Mangan) | włączony |
| Double Yakuman (za rzadkie warianty np. Kokushi 13-side wait) | wyłączony (pojedyncza wartość Yakuman) |
| Aka Dora | 3 kafelki (po jednej czerwonej piątce na kolor) |

Te wartości to świadome założenia projektowe udokumentowane tutaj do przeglądu —
nie są wymagane dosłownie przez dokument źródłowy poza pozycjami już w nim
wymienionymi (Aka Dora, wykluczenie Kyuushu Kyuuhai). Reszta drobnych konwencji
punktacji podąża za standardowymi japońskimi tabelami i będzie doprecyzowywana
przypadek po przypadku podczas TDD.

## 6. Walidacja i obsługa błędów

Nielegalna akcja (np. Ron bez kompletnej ręki, Riichi bez wystarczających punktów
lub przy ręce nie-tenpai) zwraca **wynik błędu** (`Result<T, EngineError>` lub
analogiczny discriminated union), nie rzuca wyjątku. To normalny przepływ
sterowania w grze sieciowej — klient/serwer muszą móc odrzucić nielegalny ruch
gracza bez crashowania procesu.

## 7. Testowanie

- TDD z Vitest, moduł po module, od najbardziej fundamentalnych (`tiles`, `wall`,
  `hand`) w górę do (`rules`).
- Testy Yaku jako tabele przypadków: `(ręka, kontekst) → oczekiwane Yaku + Han`,
  wzorowane na standardowych zestawach testowych używanych w innych open-source'owych
  silnikach Riichi.
- Testy `scoring` pokrywają pełną macierz Han/Fu → punkty, oya i ko, Tsumo i Ron,
  z Honba i riichi sticks.
- Testy `rules` (maszyna stanów) pokrywają pełne rundy end-to-end: rozdanie →
  dyskard → wywołania → zakończenie (wygrana lub Ryuukyoku), włącznie z
  edge-case'ami: Furiten, Chankan, wielokrotny Ron, Suukantsu.

## 8. Otwarte rozszerzenia na przyszłość (nie teraz)

- Sanma (3 graczy) — Strategy Pattern na poziomie `/rules` i `/yaku`.
- Konfigurowalny `RuleSet` — gdy multiplayer wymaga różnych pokoi z różnymi regułami.
- Rzadkie przerwania rundy (Kyuushu Kyuuhai, Suucha Riichi, Suufon Renda, Suukaikan).
- Double Yakuman — jeśli feedback graczy/porównanie z Mahjong Soul tego zażąda.
