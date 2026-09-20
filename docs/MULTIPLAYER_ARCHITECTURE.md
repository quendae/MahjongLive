# Mahjong Live — Multiplayer Architecture Contract (Phase 1)

Updated: 2026-09-20

This document closes Phase 1 of the multiplayer stage in [`ROADMAP.md`](ROADMAP.md). It is a decision record, not an implementation plan: Phase 2 implements what is written here, and anything marked open is decided before the code that depends on it is written.

## Prior art: the plan8 authoritative core

An authoritative server core already exists, unmerged, on `origin/plan8-authoritative-server` (open PR #6). It is not mentioned in the roadmap and no `server/` directory exists on `master`, although `pnpm-workspace.yaml` already declares the `server` workspace slot.

That core is a transport-free, in-memory room engine with tests. It already answers, in working code, the command envelope, the per-viewer projection, the reaction barrier, the checkpoint/restore shape and the server-held seed. It forked at `1239276` — before the match layer, the bots, the single-player orchestrator and the deterministic match history landed — so several of its answers are correct in principle and stale against today's engine.

Each Phase 1 item below carries one of three statuses:

- **Realized** — the plan8 core already implements this and it survives contact with the current engine.
- **Amend** — the plan8 core implements this but the engine changed underneath it.
- **Open** — nothing exists; a decision or a recommendation is recorded here.

## 1. Authoritative state / transport boundary

Status: **Realized** at the room layer, **Amend** for match scope, **Open** for transport.

- `shared/` stays the only mutator of Mahjong state. `applyAction(state, action) -> { state, events }` is the whole surface. No network, session or room type enters `shared/`. This preserves the existing guardrail that the client presentation never owns rules, and extends it: the transport never owns rules either.
- The room owns everything the engine deliberately does not: authorization, ordering, versioning, idempotency, the reaction barrier, the clock, and what each viewer is allowed to see.
- The room class stays transport-agnostic and synchronous: `join`, `submit(clientId, envelope) -> receipt`, `viewFor(clientId) -> RoomView`, `publicEventsSince(clientId, afterVersion)`, `checkpoint()` / `restore()`. This is the single most valuable property of the plan8 core and must survive the port — it lets a four-client integration test run in-process with no sockets, and lets the transport be replaced without touching arbitration.
- Amend: the plan8 room holds a single `RoundState` and calls `createRound` directly. Production plays a hanchan. The room must hold `MatchState` and advance hands through `advanceMatch`, with an explicit round-advance command mirroring `continueSingleGame`. Consequently `RoomStatus: 'finished'` must mean the *match* ended; the plan8 room sets it when a *round* ends.
- Transport recommendation: one WebSocket per client carrying the same command envelope in both directions, plus a minimal HTTP surface for create-room and join only. Trade-off: a single protocol to version, at the cost of no fallback on networks that block WebSockets.

Settled during implementation:

- The round-advance command is `advance-round`, and **any seated client may send it** — first through wins, the rest get `STALE_VERSION`. Host-only would mirror `start-round`, but while section 7 is still open a silent host stalls the room forever. Revisit once deadlines exist: with a turn clock, host-only becomes safe and is the better answer.
- `start-round` keeps its name although it now starts a *match*. Renaming churns the protocol for nothing.
- The room **settles** after every accepted command: it applies draws, the forced single-tile Riichi discard and empty reaction windows itself, exactly as `driveSingleGame` does, rather than waiting for a client `draw`. Clients therefore never send `draw`, and one command can bump the version several times. This is the direct answer to the "two orchestrators" risk below — the settle decisions now live in `shared/src/engine/match/orchestration.ts` and both orchestrators call them.

## 2. Hidden-information-safe projection

Status: **Realized**, with two amendments.

The classification is settled:

- **Public to everyone, including spectators** — points; melds, including `calledFrom` and `calledTileId`; discards, including `tsumogiri`, `wasLastLiveDraw`, `riichiDeclaration` and `calledBy`; riichi state; draw and discard counts; concealed hand *size*; dealer, round wind, honba, riichi sticks, current player, calls made; remaining live-wall count; revealed Dora indicators; the round-end result.
- **Per-seat, to the owner only** — that seat's exact `concealed` tiles; that seat's `drawnTileId` while awaiting discard; that seat's `ippatsuEligible`, `temporaryFuriten` and `riichiFuriten`; that seat's `legalActions`.
- **Never leaves the server** — `wall.liveWall`; `wall.deadWall` in its entirety, which is what keeps unrevealed Dora indicators and every Ura indicator hidden, since `uraIndicators()` is derived from the dead wall; in-flight `ronClaims` and `callClaims` on the `reactions` and `kan-reactions` phases; `pendingRiichi.tileId` before the declaring discard is public; and any bot evaluation internals when a bot holds a seat.

The safety property is structural, not incidental: every state projection in the plan8 core is an **allowlist**. The player view, the phase view and the wall view each name each field they emit. A new `RoundState` field is therefore hidden by default. Keep this. Do not introduce object spread into any projection.

- Amend: drop `pendingKanDora` from the public phase. Kan-Dora is now revealed immediately inside the Shouminkan and Daiminkan completion paths, so the flag is permanently false in production; under the old delayed ruling, exposing it was a timing side channel.
- Amend: the plan8 public `pendingRiichi` drops `tileId` while keeping `player` and `doubleRiichi`. That is harmless but now redundant — the same information reaches every client as `riichiDeclaration: true` on the public discard. Keep the omission; do not add a second path to the same fact.
- Spectators are `viewerSeat: null`: all four hands null, no private state, no legal actions. This is already tested.

Two classifications that read as contradictions on a first audit, both checked against the engine rather than assumed:

- `RiichiDeclared` carries `tileId` and is projected to everyone, although this section forbids projecting `pendingRiichi.tileId`. Both are correct. The event is emitted only at the commit point, by which time the same tile is already in the public pond carrying `riichiDeclaration: true`; the prohibition covers the *phase* field during the reaction window, before the declaring discard is public. The resolution depends on emission timing, which is not visible in the types.
- `HandWon` and `RoundEnded` carry `RoundEndResult`, the widest payload projected, and are passed through whole. Verified safe: `ScoredHand` holds yaku results, han/fu counts, base points and payments, and `DoraBreakdown` holds *counts only* (`dora`, `uraDora`, `akaDora`, `total`) — no indicator tiles. `RonClaim` is `{player, score}` with no hand. `exhaustive-draw` carries `tenpaiPlayers` as seat indices with no hands at all. No tile identity reaches a client through either event, including on multi-ron.

The exhaustive event switch forces a decision about a new `RoundEvent`; it cannot force the right one. Classifying a new event as public stays a compile-clean one-line change, so a payload carrying tile identity is still a human call.

## 3. Server-authoritative validation vs client responsibility

Status: **Realized**. Validation is entirely server-side.

Three layers, in order, all on the server:

1. Identity and seat — the seat is resolved from the authenticated client, and an action whose `player` field disagrees is rejected rather than rewritten.
2. Room protocol — stale version, host-only start, not eligible for this reaction window, already responded, and `resolve-reactions` rejected as server-only.
3. Engine — `applyAction` is the final arbiter; its `EngineErrorCode` is surfaced verbatim alongside a room-level rejection code so a client can distinguish "you were too slow" from "that hand does not win".

The client has no deterministic responsibility. It cannot have one: `RoundState` is not reconstructible from a projection, because the wall is absent, so the client cannot run `applyAction` against what it holds. Recommendation for Phase 2: no client-side prediction at all — render the projection, disable the control, wait for the next version. Trade-off: one round-trip of visible latency per action, against maintaining a second state model that can only ever be an approximation.

The round seed is server-held. The `start-round` command carries no seed.

## 4. Action sequencing, idempotency and replay identity

Status: **Realized** for sequencing and idempotency, **Amend** for history.

- Total order is the room's monotonic `version`, bumped once per *visible* transition. `expectedVersion` on every envelope gives optimistic concurrency; a stale command is rejected, never queued.
- `commandId` scoped to the client gives at-most-once execution: a duplicate returns the cached receipt without re-applying. The cache is bounded at 256 entries by insertion count. Measured since: a full hanchan runs well past 256 commands, so the cache evicts *within a single match*, not merely across matches. Nothing breaks today, because an evicted command is stale by version anyway, but retain by version window rather than by count.
- Deliberate and load-bearing: a reaction claim or pass does **not** bump the version. All eligible seats therefore submit against the same version concurrently, and `respondedSeats` — not the version — prevents a double answer. Preserve this exactly.

Replay and event identity reuse the existing single-player history. Do not fork it.

- `MatchHistoryRecord` in `shared/src/engine/single/history.ts` is already the append-only log of accepted `RoundAction`s with explicit `round-advance` entries, and `replayMatchHistory` is exact re-execution through `applyAction` and `advanceMatch`. Multiplayer emits the same record.
- Amend to version 2: `humanSeat` and a single `botDifficulty` are single-player-shaped. Replace them with a four-entry seat descriptor recording, per seat, whether it was human or bot and under which profile. Keep `seed`, keep `entries`, keep the replay loop byte-identical, keep `parseMatchHistory` validating so exported single-player files still load.
- Resolved, and the most dangerous item in this document. The plan8 room seeded a single round directly, while `replayMatchHistory` derives each hand's seed as `deriveSingleRoundSeed(baseSeed, roundNumber)`. Seeding is now unstatable by a caller: `createSeededMatch(seed)` and `advanceSeededMatch(match, seed)` in `shared/src/engine/match/orchestration.ts` are the only way to start or advance a hand, and single-player, replay and the room all go through them.

  The failure mode this closes is worth recording, because it is quiet. Measured by deliberately reverting to a raw seed per hand: the match still ran ten hands, and `wind`, `hand`, `dealer` and `honba` matched on every one — **only the walls differed**. It replayed cleanly to a different game. A parity test drives a full hanchan through the room against a single-player match on the same seed and compares per-hand `MatchState`, wall included; that wall assertion is the whole guard.
- `resolve-reactions` is recorded with source `system`, exactly as `single.ts` records it, so both orchestrators emit an identical entry stream for identical decisions.
- The room's per-version transition log is a *catch-up* log, not a replay log. It stores raw engine events and projects them per viewer at read time. The two logs have different jobs and different lifetimes; do not merge them.

## 5. Lobby and room-code lifecycle

Status: **Realized** for seating, **Open** for codes, identity and lifetime.

- Realized: seat assignment with an optional preferred seat, first joiner becomes host, explicit rejections for a full room / taken seat / invalid seat, per-seat ready flags, host-only start requiring four occupied and ready seats, and a room registry with create / get / list / remove / restore.
- Open — code allocation. The plan8 registry takes a caller-supplied room id and throws on collision. Recommendation: a six-character code from an alphabet that excludes `I`, `L`, `O`, `U`, `0` and `1`, generated server-side with retry on collision, looked up case-insensitively. At this scale, transcription ambiguity matters more than code length.
- Open — identity. `ClientId` is an opaque string with no authentication, so anyone who learns one can act as that seat. Recommendation: a server-issued join token bound to `(room, seat)`, returned on join, stored client-side, replayed on reconnect. This is a prerequisite for reconnect, not an enhancement.
- Open — room lifetime. Recommendation: evict an empty `lobby` room after a short idle period; retain a `playing` room well past the last disconnect, because that retention *is* the reconnect window; drop a `finished` room once the result is acknowledged or a TTL expires. Trade-off: longer retention costs memory and code space and is the only thing that makes reconnect real.

## 6. Reconnect and resume

Status: **Realized** in concept, **Amend** for match scope and one restore hole.

- Reconnect is snapshot-first: re-authenticate to the seat, take a complete `viewFor(clientId)` snapshot, then optionally take `publicEventsSince(clientId, lastSeenVersion)` to animate what was missed. The snapshot is self-sufficient; the event tail is presentation only and may be skipped entirely on a long absence.
- This matches the existing autosave model rather than inventing a second one. Single-player already persists only fully resolved authoritative state and explicitly keeps presentation frames out of the save, so a reload resumes from resolved state and never mid-animation. Multiplayer keeps the same rule at the server boundary.
- `RoomCheckpoint` is a plain JSON value carrying id, status, version, host, seats, seed, round and the reaction barrier. It now also carries `MatchState`. It does **not** carry an in-progress history record: history emission is deferred until there is a real multiplayer match to record, since `MatchHistoryRecord` v2 changes a persisted format the client reads.
- Client persistence: single-player owns `mahjong-live:single:v1` and `mahjong-live:history:v1`. Multiplayer must not reuse either key. The multiplayer client persists only room code, seat, join token and last seen version, and re-fetches everything else. Trade-off: no offline resume, in exchange for no possibility of a stale local board contradicting the server.
- Fixed: restoring a checkpoint whose reaction barrier was absent while the round sat in a reaction phase used to rebuild an empty barrier, silently discarding responses already given. Such a checkpoint is now rejected. The case that actually lost data was a *pass*, which leaves no trace in round state — claims survive in `phase.ronClaims`, passes do not.

## 7. Timeout, disconnect and AFK policy

Status: **Open**. The plan8 core has no clock of any kind.

This is not a gap that can be deferred into Phase 3. Reaction resolution waits for *every* eligible seat, so a single silent client stalls the room permanently.

- Recommendation: two server-side deadlines — a turn deadline on `awaiting-draw` and `awaiting-discard`, and a shorter reaction deadline on `reactions` and `kan-reactions`. An expiry is a server-generated action applied through the same `applyAction` path and written into history, so replay stays exact.
- Default on expiry — reaction window: auto-pass. Turn: draw if pending, then tsumogiri the drawn tile, which is the behaviour `single.ts` already applies to a forced discard. Trade-off: auto-pass can cost a seat a winning Ron, but auto-winning surprises a player who intended to pass to stay out of furiten, and an auto-win is irreversible where a missed Ron is not.
- Bot takeover: recommended, and cheap. `chooseBotDecisionForDifficulty(round, seat, difficulty)` already returns a legal decision for any seat from full state, and neither the bot evaluator nor the difficulty layer uses any RNG, so a takeover replays deterministically. Recommendation: after a configured number of consecutive expiries, or a disconnect longer than a configured interval, mark the seat bot-controlled at the `standard` profile, keep it reclaimable on reconnect, and record both the takeover and the profile in history — bot output is profile-dependent, so a record without the profile does not replay.

## 8. Spectator and public-history protocol

Status: **Realized** for the projection, **Open** for the protocol around it.

- A spectator is a viewer with no seat. The existing projection already gives exactly the right thing: concealed counts without hands, no private state, no legal actions, and claim events filtered out until the barrier resolves.
- Open: spectators are not modelled as room members at all. Recommendation: allow seatless connections, cap their number per room, and do not offer any consent-based hand reveal in Phase 2 — a consenting player is an information channel to a colluding seat.
- Public live feed: the per-viewer transition tail with `viewerSeat: null`.
- Public history: serve the `MatchHistoryRecord` only after the match ends. That record replays to full information, including every hand, so exporting it mid-match defeats the entire projection layer.
- Open decision, recorded rather than settled: whether a live spectator feed is delayed. Recommendation for Phase 2 is no delay and no mid-match export, because a broadcast delay is the only genuine defence against a spectator relaying to a seated player and it is not worth building before there is an audience.

## Gap list — what Phase 2 builds from nothing

Roughly ordered by dependency.

1. The `server/` package itself. It exists only on an unmerged branch; the workspace slot is already declared on `master`. Port the room engine first, with no transport.
2. Match-level room loop: hold `MatchState`, advance hands, end the match. Depends on 1.
3. History emission from the room, and `MatchHistoryRecord` version 2 with per-seat descriptors. Depends on 2, because entries carry round numbers and round-advance markers.
4. Deadlines, expiry actions and bot takeover. Depends on 2 and 3, because every expiry is a history entry.
5. Room-code allocation, join tokens and room TTL. Independent of 2–4, required before any transport is useful.
6. Network transport: WebSocket, envelope framing, per-viewer fan-out, backpressure. Depends on 1 and 5.
7. Checkpoint persistence beyond the in-memory registry. Depends on 1 and 6; the checkpoint shape needs no further design.
8. Client multiplayer state layer: a `RoomView`-driven render path alongside the existing `SingleGameState` path, reconnect handling, and disabled-control latency states. Depends on 6. This is the largest single item — the current client is built around `SingleGameState` end to end, including history, replay and autosave.
9. Four-client browser E2E and hidden-information leakage tests. Depends on 6 and 8.

## Risks specific to this codebase

- **Event projection is a denylist while state projection is an allowlist.** The event filter drops exactly the two claim events and special-cases the drawn tile; every other `RoundEvent` passes through untouched. The day someone adds an event carrying a wall tile, an ura indicator or another seat's hand, it ships to all four clients and no test fails. Invert it into an exhaustive switch over `RoundEvent['type']` with no default pass-through, so a new event type is a compile error rather than a leak.
- **Projection drift on new engine fields.** The allowlist is safe in the leak direction and unsafe in the other: a new per-seat field will be silently missing from the view, and the client will paper over it with a local guess that diverges from the server. Add a test asserting the projected key set equals an explicitly declared set, so adding a field forces a decision about it.
- **Two orchestrators over one engine.** Largely closed. `shared/src/engine/match/orchestration.ts` now holds the decisions both orchestrators must make identically: seed derivation, `forcedSeatAction`, `isReactionPhase` and `reactionEligibleSeats`. The room settles like `driveSingleGame` instead of waiting for a client `draw`.

  One piece stays deliberately duplicated: the empty-reaction-window auto-resolve. The two control flows genuinely differ — `single.ts` polls three bots and then always applies `resolve-reactions`, while the room waits for every eligible human seat and resolves when the barrier fills. The shared part of that decision is *who is eligible*, and that is what was extracted. Wrapping the rest would be an abstraction over two different control flows for its own sake.
- **Reaction arbitration races.** The barrier is correct only while three invariants all hold: eligibility is computed once per window from full state, no reaction command bumps the version, and `resolve-reactions` is server-only. Breaking the second is the subtle one — bumping the version on a claim would make every other seat's in-flight response fail as stale, silently converting a concurrent window into first-click-wins. Separately, a failed resolution currently throws; that is the right instinct for an invariant, but under a live transport it takes the process down, so it needs a room-level fault state that isolates one room.
- **Replay identity drift.** Three independent ways the recorded history stops reproducing the match: the room deriving round seeds differently from `deriveSingleRoundSeed`; the room recording a different trace source for `resolve-reactions` than `single.ts` does; and timeouts or bot takeovers applied without a corresponding history entry. All three produce a record that replays *cleanly to a different game*, which is far worse than one that fails loudly. The guard is a test that drives a full match through the room and asserts state equality against the replay at every entry.
- **Unbounded catch-up log.** The transition log grows one entry per version for the room's lifetime while the command cache is capped. Trim it to the oldest version a disconnected client is still allowed to resume from.

## Recommendation on PR #6

Land the ported core fresh on `master`; do not revive the branch. It forked before the match layer, the bots, the single-player orchestrator and the deterministic history all landed, and its own tip is inconsistent — the final commit removed the seed from the client command without updating the room that reads it, so the branch does not typecheck as it stands. Treat its four ideas and its tests as the specification, and re-apply them against today's `MatchState` and history APIs: that is a smaller and more honest diff than rebasing across roughly four thousand lines of intervening engine work.
