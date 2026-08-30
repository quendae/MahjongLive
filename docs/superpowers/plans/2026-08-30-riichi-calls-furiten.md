# Riichi, Calls & Furiten — Implementation Plan

**Goal:** Extend the Plan 5 round core with the normal non-Kan interaction layer: Riichi/Double
Riichi/Ippatsu, permanent + temporary + Riichi Furiten, Chi/Pon claims, deterministic reaction
priority, Ura Dora on Riichi wins, and exhaustive-draw tenpai/noten settlement.

**Architecture:** Keep the existing pure reducer and reaction window. Claims do not mutate the
board until `resolve-reactions`; this lets an authoritative server collect simultaneous intents and
apply one deterministic result. Ron claims always dominate calls; Pon dominates Chi. Kan is Plan 7
because it changes dead-wall/rinshan flow and introduces Chankan/Kan-Dora timing.

---

## Ruling Ledger

`Ruling:` **Riichi declaration + discard are one player action, but the declaration is pending
through the reaction window.** `riichi-discard` places the declaration discard immediately and
stores `pendingRiichi` in the reaction phase. If that discard is won by Ron, the declaration never
completes and no 1,000-point deposit is paid. If no Ron occurs, `resolve-reactions` activates
Riichi, deducts exactly 1,000 points and adds one table stick before resolving any Chi/Pon. A
Chi/Pon on the declaration discard does not invalidate Riichi, but the resolved call cancels
Ippatsu.

`Ruling:` **Legal Riichi discard means the resulting 13-tile state has at least one structural
winning tile type.** The wait query uses `resolveWinningHands` over all 34 tile types and does not
require the prospective winning tile to have yaku. Riichi itself supplies yaku after declaration.

`Ruling:` **Riichi requires a closed hand, >= 1,000 points and >= 4 live-wall tiles remaining.**
After Riichi, ordinary turns are tsumogiri-only; Plan 7 will add the legal Kan exception.

`Ruling:` **Double Riichi is derived, not requested.** The declaration is Double Riichi iff it is
the player's first discard and no call has yet been resolved.

`Ruling:` **Ippatsu is history state.** It becomes eligible when a pending Riichi is activated,
survives until the declarer's next discard, and is cancelled for all players when any Chi/Pon
(later Kan) is resolved.

`Ruling:` **Permanent discard Furiten is computed dynamically from the current wait set.** If any
current structural winning tile type appears in the player's own discard history, Ron is blocked
on every wait; Tsumo remains legal.

`Ruling:` **Temporary Furiten is created by passing a legal Ron opportunity.** On
`resolve-reactions`, a player who could legally Ron (before Furiten) but submitted no Ron claim
becomes temporary Furiten. It clears on that player's next normal draw. If the player is already in
Riichi, passing Ron instead sets `riichiFuriten`, which lasts for the hand.

`Ruling:` **Calls are claims until reaction resolution.** `chi` carries two exact hand tile IDs;
`pon` carries two exact hand tile IDs. The discard is implicit from the reaction window. A resolved
call moves the exact discard object into the meld and marks that discard `calledBy`.

`Ruling:` **Call priority.** Any Ron claims end the hand and suppress every call. Otherwise Pon
beats Chi. Chi is legal only for the next player in turn order. A selected call transfers the turn
to the caller, who must discard without drawing.

`Ruling:` **No Chi/Pon on the last live-wall discard.** Once the live wall is exhausted, only Ron
may react; otherwise the round proceeds to exhaustive settlement.

`Ruling:` **Ura indicators use an abstract dead-wall layout.** Plan 5 already reserves the first
five `deadWall` entries for Dora/Kan-Dora indicators. Entries 5..9 are the matching hidden Ura
indicators. Plan 7 will use entries 10..13 as Rinshan tiles. This is an engine indexing convention,
not a rendering statement about physical wall position.

`Ruling:` **Exhaustive tenpai/noten is structural.** A player is tenpai iff the wait-type query is
non-empty. With 1/2/3 tenpai players, the standard 3,000-point noten pool is split 3000/1500/1000;
0 or 4 tenpai yields no transfer. Riichi sticks remain on the table. Nagashi Mangan remains a
separate Plan 7 settlement step because its Mangan payment interaction with multiple qualifiers and
Honba deserves an explicit test matrix.

---

## Target Changes

```text
shared/src/engine/wall/wall.ts             # hidden Ura indicator helper
shared/src/engine/rules/waits.ts            # structural waits + Furiten helpers
shared/src/engine/rules/waits.test.ts
shared/src/engine/rules/types.ts            # Furiten, call claims/actions/events
shared/src/engine/rules/round.ts            # Riichi/calls/arbitration/exhaustive settlement
shared/src/engine/rules/riichiCalls.test.ts
shared/src/engine/rules/furiten.test.ts
shared/src/engine/rules/exhaustive.test.ts
```

## Task 1 — Wait Query / Furiten Primitives

- `winningTileTypeKeys(concealedBeforeWin, fixedMelds): Set<string>` tries all 34 tile types that do
  not exceed the four-copy physical cap and keeps types for which `resolveWinningHands` returns at
  least one candidate.
- `isDiscardFuriten(player)` intersects that set with player's own discard types.
- Unit tests: ryanmen waits, tanki, Chiitoitsu, Kokushi, fixed open meld, discarded one-of-many wait
  makes the entire wait Furiten.

## Task 2 — Riichi + Ippatsu + Ura

- Add action `{ type:'riichi-discard'; player; tileId }`, whose declaration remains pending in the
  reaction phase until Ron has been excluded.
- `getLegalActions` exposes all physical discard IDs that leave structural tenpai.
- On no-Ron reaction resolution, deduct 1,000 points and increment table `riichiSticks` exactly
  once, derive Double Riichi, and set Ippatsu.
- Enforce tsumogiri-only after declaration.
- Pass matching Ura indicators to scoring; scorer already gates Ura by `hand.isRiichi`.

## Task 3 — Furiten Lifecycle

- Add `temporaryFuriten` and `riichiFuriten` to player state.
- Ron legality checks permanent + temporary + Riichi Furiten.
- On resolved pass, mark Furiten only for players who had an otherwise legal Ron.
- Clear temporary Furiten on that player's next draw.
- Do not block Tsumo.

## Task 4 — Chi/Pon Claims and Priority

- Add exact-ID `chi` and `pon` actions and call claim state.
- Enumerate legal physical combinations (important around red fives).
- Resolve `Ron > Pon > Chi`.
- Execute call only on resolution: remove hand tiles, mark discard called, append open meld, clear
  all Ippatsu eligibility, increment `callsMade`, transfer turn to caller in no-draw discard phase.

## Task 5 — Exhaustive Tenpai/Noten

- On final discard with no Ron/call, compute structural tenpai for all four players.
- Apply standard 3,000 point pool.
- Extend `exhaustive-draw` result with tenpai players + payments.
- Preserve Riichi sticks.

## Verification

- Existing Plan 1-5 tests stay green.
- New reaction tests include simultaneous Ron + Pon (Ron wins), Pon + Chi (Pon wins), red-five Chi
  combinations, pass-Ron temporary Furiten, Riichi pass-Ron persistent Furiten, call cancelling
  Ippatsu, Double Riichi invalidated by any prior call, Ura Dora scoring, and noten payment matrix.
- `pnpm --filter @mahjong-live/shared typecheck`
- `pnpm --filter @mahjong-live/shared test`
