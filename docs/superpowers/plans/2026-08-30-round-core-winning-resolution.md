# Round Core + Winning Resolution — Implementation Plan

> **For agentic workers:** use subagent-driven development when available. Keep the reducer pure,
> keep state JSON-serializable, and record domain/architecture calls as `Ruling:` entries below.

**Goal:** Connect the shipped tile/wall/hand/yaku/scoring layers into the first playable vertical
slice of a Riichi round: deal 13 tiles, draw, discard, evaluate Tsumo/Ron, collect simultaneous Ron
claims, settle points, and end a hand. The key deliverable is a production-safe constructor of
semantic `WinningHand` candidates that preserves the winning-tile identity invariant documented in
`yaku/context.ts`.

**Architecture:** `/shared/src/engine/rules` owns immutable round state and a pure reducer:

```ts
applyAction(state, action): { ok: true; state; events } | { ok: false; error }
```

The engine contains no timers. After a discard it enters a reaction window. A future server gathers
claims and calls `resolve-reactions`; Plan 6 will add Chi/Pon/Kan arbitration to the same window.

Plan 5 deliberately ships the **closed/no-call gameplay slice** while making the resolver accept
already-resolved fixed melds. Plan 6 adds calls, Riichi/Ippatsu, Furiten, Kan/Rinshan/Chankan, Ura,
exhaustive-draw tenpai payments and call-priority arbitration.

---

## Ruling Ledger

`Ruling:` **Physical tile identity becomes serializable.** Add optional `id?: number` to tile
instances and assign unique IDs 0..135 in `build136Tiles()`. Tile comparison/type keys continue to
ignore the ID. Hand-written unit fixtures may omit it; real round state may not.

`Ruling:` **Actions address tiles by physical ID, not object reference or array index.** Object
identity is useful inside a single reducer invocation but is not a network/storage contract.

`Ruling:` **The winning resolver never trusts raw decomposition identity.** It appends the exact
winning tile object from round state, decomposes by tile type, then emits every semantically-valid
placement of that exact object into a concealed group/pair that could contain that tile type. This
turns ambiguous duplicate-copy cases into explicit score candidates rather than array-order bugs.

`Ruling:` **A winning tile cannot be assigned into a pre-existing fixed meld.** Fixed melds existed
before the win. Normal Tsumo/Ron in Plan 5 may complete only the loose concealed part. Chankan and
Kan-specific semantics belong to Plan 6.

`Ruling:` **Special shapes require zero fixed melds.** Chiitoitsu and Kokushi candidates are emitted
only for a fully concealed hand.

`Ruling:` **Reaction timing is external, reaction resolution is deterministic.** `ron` records a
claim; it does not immediately end the hand. `resolve-reactions` ends with all collected Ron claims
or advances to the next draw if there are none. This preserves V1 multiple-Ron support and gives
Plan 6 a place to add Pon/Kan/Chi claims. Standard call priority is Ron > Pon/Kan > Chi.

`Ruling:` **Plan 5 has no Riichi or calls.** Player state already carries future-compatible flags,
but new rounds initialize them false. Therefore Riichi sticks remain zero in normal Plan 5 play.

`Ruling:` **Tenhou/Chiihou are derived from round history, not caller flags.** Dealer Tsumo before
any discard is Tenhou; a non-dealer Tsumo on that player's first draw with no calls is Chiihou.
Plan 5 has no calls, but the state keeps a `callsMade` counter for Plan 6.

`Ruling:` **Haitei/Houtei come from wall state.** A draw that empties the live wall is marked as the
last live draw. Tsumo on it is Haitei; Ron on its subsequent discard is Houtei.

`Ruling:` **Exhaustive draw settlement is deferred.** If the final discard receives no Ron claim,
Plan 5 ends the hand as `exhaustive-draw` without tenpai/noten payments. Plan 6 owns those payments
and Nagashi Mangan settlement.

---

## Target Files

```text
shared/src/engine/tiles/types.ts                # optional physical ID
shared/src/engine/wall/wall.ts                  # IDs on real wall tiles
shared/src/engine/wall/wall.test.ts             # uniqueness regression
shared/src/engine/rules/winning.ts              # semantic WinningHand candidate resolver
shared/src/engine/rules/winning.test.ts
shared/src/engine/rules/types.ts                # RoundState / Action / Event / errors
shared/src/engine/rules/round.ts                # createRound, legal actions, reducer
shared/src/engine/rules/round.test.ts
shared/src/engine/rules/integration.test.ts     # full deal -> win flows
shared/src/engine/rules/index.ts
```

---

## Task 1 — Stable Physical Tile IDs

- Extend both tile variants with optional `id?: number`.
- `build136Tiles()` assigns exactly one unique integer ID to every physical tile.
- IDs survive wall shuffling/draw/discard via normal object movement.
- `tileTypeKey`, equality and Dora mapping ignore IDs.
- Tests: 136 unique IDs, still 34 types x 4 copies, 3 red fives.

## Task 2 — Semantic Winning Candidate Resolver

Public API:

```ts
export interface WinningResolutionInput {
  concealedBeforeWin: readonly Tile[];
  winningTile: Tile;
  fixedMelds: readonly WinningMeld[];
  winCondition: 'tsumo' | 'ron';
  seatWind: Wind;
  roundWind: Wind;
  isRiichi?: boolean;
  isDoubleRiichi?: boolean;
  isIppatsu?: boolean;
  isHaitei?: boolean;
  isHoutei?: boolean;
  isRinshan?: boolean;
  isChankan?: boolean;
  isTenhou?: boolean;
  isChiihou?: boolean;
}

export function resolveWinningHands(input: WinningResolutionInput): WinningHand[];
```

Rules:
- Validate conceptual loose-tile count: before-win = `13 - 3 * fixedMelds.length`.
- Completed loose part = before + exact `winningTile` object.
- If no fixed melds, emit Chiitoitsu/Kokushi when valid.
- Standard resolution chooses a pair from the loose part, decomposes the rest with
  `decomposeMelds`, requiring exactly `4 - fixedMelds.length` concealed melds.
- Convert concealed decomposition melds to `WinningMeld { isOpen: false }`, prepend fixed melds.
- For every standard reading, generate identity variants by moving the exact winning-tile object
  into each concealed meld/pair containing the same tile **type**, swapping it with the same-type
  object currently occupying that target. Never move it into `fixedMelds`.
- Deduplicate equivalent semantic candidates.

Tests must include the known `345m + 555m` duplicate-copy hazard and show separate candidates with
winning 5m assigned to sequence vs triplet, producing different Pinfu/Sanankou semantics where
appropriate.

## Task 3 — Round State and Deal

Types:
- `PlayerIndex = 0 | 1 | 2 | 3`.
- `RoundPlayerState`: points, concealed tiles, fixed melds, discards, riichi flags, draw/discard
  counters.
- `RoundPhase`: `awaiting-draw`, `awaiting-discard`, `reactions`, `ended`.
- `RoundState`: wall, players, dealer, round wind, honba, riichi sticks, current player,
  `callsMade`, phase.
- Discards retain the exact tile object + physical ID and whether they followed the last live draw.

`createRound(rng, options)`:
- build wall,
- deal 13 tiles to each player,
- start dealer in `awaiting-draw`,
- default 25,000 points each.

## Task 4 — Draw / Discard / Tsumo Reducer

Actions:
- `{ type: 'draw'; player }`
- `{ type: 'discard'; player; tileId }`
- `{ type: 'tsumo'; player }`

Behavior:
- illegal actions return structured errors, never throw;
- draw moves one real tile from live wall into concealed and records whether it was last-live;
- discard addresses one physical ID, removes that exact object, adds a discard record, opens the
  reaction window;
- Tsumo may only use the current draw as `winningTile`;
- build semantic candidates with Task 2, score with `scoreBestCandidate`, reject no-yaku/incomplete
  wins, otherwise settle points and end the hand.

## Task 5 — Ron Claims + Multiple Ron

Actions:
- `{ type: 'ron'; player }`
- `{ type: 'resolve-reactions' }`

Behavior:
- Ron is available only against the current reaction discard and never to the discarder;
- exact discarded tile object becomes `winningTile`;
- claims are validated immediately through winning resolution + scoring;
- multiple unique Ron claims may coexist;
- resolution with claims charges the discarder for every winner and ends the hand;
- resolution without claims advances to the next player's draw, except after the last-live discard,
  which ends as exhaustive draw.

Plan 6 will add Furiten before `ron` validation and add non-winning claims to the same phase.

## Task 6 — Legal Actions + Events

Expose a query suitable for server/bot/client use without mutating state:

```ts
getLegalActions(state, player): LegalAction[]
```

Events should include at minimum:
- `TileDrawn`
- `TileDiscarded`
- `RonClaimed`
- `HandWon`
- `RoundEnded`

The server may later filter hidden event fields before broadcasting; the shared engine returns the
full authoritative event.

## Task 7 — Integration Coverage

Required flows:
- deterministic createRound deals 13 each and preserves 136 unique physical IDs across all zones;
- draw -> discard -> resolve -> next draw;
- invalid turn/tile/win actions return errors and leave original state unchanged;
- closed Tsumo is scored and settles points;
- Ron uses the exact discard object as winning tile;
- two simultaneous Ron claims both settle against one discarder;
- last-live Tsumo gets Haitei;
- last-live discard Ron gets Houtei;
- no claim after last-live discard ends exhaustive draw;
- Tenhou and Chiihou flags are derived correctly.

Verification gate:

```bash
pnpm --filter @mahjong-live/shared typecheck
pnpm --filter @mahjong-live/shared test
```
