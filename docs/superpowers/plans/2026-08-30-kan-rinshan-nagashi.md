# Kan, Rinshan, Chankan & Nagashi Mangan — Implementation Plan

**Goal:** Complete the V1 round mechanics that depend on the dead wall: Ankan, Daiminkan,
Shouminkan/Kakan, Rinshan draws, Chankan, Kan-Dora timing, and Nagashi Mangan settlement.

**Architecture:** Extend the pure Plan 6 reducer without turning Kan into a special case of an
ordinary draw. A completed Kan always consumes one Rinshan tile and replenishes the 14-tile dead
wall from the tail of the live wall. Shouminkan has an explicit pre-completion reaction phase so
Chankan can cancel it before any Rinshan draw, Kan-Dora reveal, or Ippatsu cancellation.

---

## Ruling Ledger

`Ruling:` **V1 supports Ankan, Daiminkan and Shouminkan.** Kans are represented as `quad`
`PlayerMeld`s. Ankan is closed; Daiminkan and Shouminkan are open. A fifth completed Kan is
illegal. The core spec explicitly excludes Suukaikan abortive draw, so completing the fourth Kan
does not abort the hand and Suukantsu remains achievable.

`Ruling:` **Rinshan preserves a 14-tile dead wall.** Engine dead-wall slots 0..4 are Dora
indicators, 5..9 their Ura partners, and slot 10 is the next Rinshan tile. Drawing Rinshan removes
slot 10, moves the final live-wall tile into the dead wall, and therefore reduces the number of
normal live draws by one while keeping exactly 14 dead-wall tiles.

`Ruling:` **Tenhou-style Kan-Dora timing.** Ankan reveals its new Kan-Dora immediately before the
Rinshan draw. Daiminkan and completed Shouminkan create a delayed Kan-Dora reveal. That delayed
indicator is revealed after the resulting discard, or immediately before a chained Kan/Rinshan.
Therefore a Rinshan win immediately after Daiminkan/Shouminkan does not use that Kan's new Dora.

`Ruling:` **Only Shouminkan opens Chankan reactions in V1.** Tenhou does not permit Kokushi to rob
an Ankan, so Ankan completes immediately. Daiminkan already competes with Ron on the original
discard; Ron has priority there and cannot be claimed retroactively after the Kan resolves.

`Ruling:` **Chankan interrupts the Kan before completion.** The exact added physical tile is exposed
in a `kan-reactions` phase. A successful Ron scores `Chankan`, may be multiple Ron, and is paid by
the would-be Kan declarer. The Pon remains a Pon, no Rinshan is drawn, no new Kan-Dora is revealed,
and Ippatsu is not cancelled because the Kan never completed.

`Ruling:` **Passing Chankan participates in Furiten.** Structural completion on the added tile sets
temporary Furiten, or persistent Riichi Furiten for a Riichi player, using the same no-yaku-aware
structural rule as an ordinary passed Ron.

`Ruling:` **Every completed Kan cancels Ippatsu.** This includes the player's own Ankan. A Kan that
is robbed by Chankan does not cancel Ippatsu.

`Ruling:` **Ankan after Riichi follows the Tenhou wait-preservation rule.** The newly drawn tile must
be one of the four tiles used in the Kan (no okuri-kan), and the set of structural winning tile
types must be exactly unchanged before vs after converting the four identical concealed tiles into
a closed quad. Shouminkan and Daiminkan are unavailable after Riichi because the hand is already
locked closed.

`Ruling:` **Rinshan is a normal Tsumo for Fu plus the Rinshan Kaihou yaku.** It never combines with
Haitei. A completed Kan reduces the live wall, but its replacement draw is identified explicitly as
Rinshan rather than as the last normal live-wall draw.

`Ruling:` **Nagashi Mangan uses Tenhou-style qualification.** At exhaustive draw, a player qualifies
when every own discard is terminal/honor and none of those discards was called. The player may have
called opponents' tiles and need not be tenpai.

`Ruling:` **Nagashi replaces noten payments and is a bonus-style exhaustive settlement.** If one or
more players qualify, ordinary 3,000-point tenpai/noten payments are zero. Each qualifier receives
an independent Mangan-Tsumo payment: dealer 4,000 from every other player; nondealer 4,000 from the
dealer and 2,000 from each other nondealer. Multiple qualifiers' transfers are applied
independently. Honba and Riichi sticks are not added to Nagashi payments; Riichi sticks remain on
the table. Structural `tenpaiPlayers` are still recorded for later dealer-continuation logic.

---

## Target Changes

```text
shared/src/engine/wall/wall.ts
shared/src/engine/wall/wall.test.ts
shared/src/engine/rules/types.ts
shared/src/engine/rules/round.ts
shared/src/engine/rules/kan.test.ts
shared/src/engine/rules/chankan.test.ts
shared/src/engine/rules/nagashiSettlement.test.ts
```

## Task 1 — Dead-wall Rinshan primitive

- Add `drawRinshan(wall)`.
- Consume dead-wall slot 10 and replenish from the live-wall tail.
- Preserve 14 dead-wall tiles and physical IDs.
- Add tests for sequential Rinshan draws and live-wall shrinkage.

## Task 2 — Kan action model

- Extend legal/action types with exact-ID `ankan`, `daiminkan`, `shouminkan`.
- Track `pendingKanDora` on the post-Rinshan discard phase.
- Add `kan-reactions` for Shouminkan only.
- Reject a fifth completed Kan.

## Task 3 — Ankan / Daiminkan

- Enumerate exact physical copies, including red five identity.
- Ankan: validate Riichi restriction, flush older delayed Kan-Dora, create closed quad, immediately
  reveal this Kan-Dora, cancel Ippatsu, draw Rinshan.
- Daiminkan: join normal discard reaction arbitration alongside Pon/Chi; Ron still dominates.
  Resolve the open quad, cancel Ippatsu, draw Rinshan, leave this Kan-Dora pending.

## Task 4 — Shouminkan / Chankan

- Allow upgrading an existing open Pon with the exact fourth tile.
- Flush any previous delayed Kan-Dora before opening the Chankan window.
- Score Ron from `kan-reactions` with `isChankan=true`, normal Furiten and multi-Ron.
- If no Ron, complete the quad, cancel Ippatsu, draw Rinshan and leave the new Kan-Dora pending.

## Task 5 — Delayed Kan-Dora lifecycle

- Reveal pending Kan-Dora when the Rinshan player makes a discard, before creating the ordinary
  reaction window so Ron on that discard sees the indicator.
- Flush a previous pending indicator before a chained Kan.
- Do not reveal the newly pending indicator if the player wins immediately by Rinshan.

## Task 6 — Nagashi exhaustive settlement

- Reuse `detectNagashiMangan` with `RoundDiscard.calledBy`.
- Compute independent Mangan-Tsumo deltas for every qualifier.
- Suppress noten payments when any qualifier exists.
- Preserve Riichi sticks and expose Nagashi qualifiers/payment deltas in the exhaustive result.

## Verification

- Existing Plans 1–6 remain green.
- New tests cover: Ankan, Riichi Ankan wait preservation/no-okuri-kan, Daiminkan vs Ron priority,
  Shouminkan Chankan and multi-Ron, Chankan Furiten, Ippatsu cancellation/non-cancellation,
  immediate vs delayed Kan-Dora, chained Kans, Rinshan yaku, fourth Kan allowed/fifth rejected,
  Nagashi with own calls, called discard disqualification, multiple Nagashi qualifiers, and no
  noten settlement when Nagashi occurs.
- `pnpm --filter @mahjong-live/shared typecheck`
- `pnpm --filter @mahjong-live/shared test`
