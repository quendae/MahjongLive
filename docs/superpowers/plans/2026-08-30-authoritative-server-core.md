# Authoritative Server Core — Implementation Plan

**Goal:** Start sub-project 2/6 by wrapping the completed pure Riichi reducer in a deterministic, authoritative room/session layer that can later be exposed through WebSocket without leaking hidden information or letting clients arbitrate game rules.

**Architecture:** The server owns the only complete `RoundState`. Clients submit authenticated commands tied to a public room version. The server validates seat ownership, calls the shared reducer, records authoritative transitions, and projects a viewer-specific snapshot/events. Networking, clocks, persistence and matchmaking remain outside this plan; they will consume this core in the next server plan.

---

## Ruling Ledger

`Ruling:` **The client never owns or submits state.** A client submits intent only. The server keeps the full wall, all concealed hands, Furiten flags and pending reaction claims and is the only component allowed to call `applyAction` against the authoritative state.

`Ruling:` **Player seat is derived from the authenticated room membership, never trusted from payload.** Player-bound `RoundAction.player` must equal the sender's seat. `resolve-reactions` is server-only.

`Ruling:` **Reaction pass is a server-protocol command, not a rules-engine action.** During `reactions` / `kan-reactions`, every seat that has at least one legal reaction must explicitly claim one response or pass. Once every eligible seat responded, the room calls engine `resolve-reactions` exactly once. A transport timeout will later be represented by the same server-side pass operation.

`Ruling:` **Hidden reaction claims do not advance the public version.** A Ron/Pon/Chi/Daiminkan claim mutates only hidden authoritative claim state while the reaction window stays open. All eligible players therefore answer against the same public `phaseVersion`. The public version advances when an externally visible state transition occurs (discard, draw, resolved call/win, round start, etc.).

`Ruling:` **Commands are idempotent by `(clientId, commandId)`.** Re-sending the same command after a reconnect returns the prior receipt and never applies the action twice.

`Ruling:` **Stale public versions are rejected.** Ordinary commands and reaction responses must target the current public version. A response from an earlier phase cannot be applied to a newer phase even if the same seat is active again.

`Ruling:` **Opponent concealed information is never projected.** A seated viewer sees their own exact concealed tiles. For every other seat, only concealed tile count is exposed. Spectators see counts for all players.

`Ruling:` **Wall secrecy is strict.** Public state contains remaining live-wall count and visible Dora indicators only. Live-wall order, dead-wall contents and Ura indicators are never included in snapshots.

`Ruling:` **Furiten flags and legal actions are private.** Only the viewer's own Furiten state and legal actions are exposed. Opponents' temporary/Riichi Furiten and legal reactions are not projected.

`Ruling:` **Pending reaction claims are private until resolution.** `ronClaims` / `callClaims` are stripped from projected phases and claim events are not part of the public transition log. This avoids response-order information leaking into gameplay.

`Ruling:` **Reconnect is snapshot + version.** Because authoritative state is deterministic and serializable, a reconnecting client can receive one fresh viewer projection plus current public version. Replay/event streaming is an optimization, not a correctness requirement.

`Ruling:` **Round seed is server input and is recorded.** Plan 8 accepts an explicit deterministic seed so tests and future persisted matches can replay the exact initial wall. Client transport will not be allowed to choose the production seed.

---

## Target Files

```text
shared/package.json                         # explicit workspace exports for server use
server/package.json
server/tsconfig.json
server/src/protocol.ts                      # commands, receipts, public view types
server/src/projection.ts                    # full RoundState -> viewer-safe projection
server/src/room.ts                          # authoritative room/session state machine
server/src/roomManager.ts                   # in-memory room lifecycle
server/src/index.ts
server/src/projection.test.ts
server/src/room.test.ts
server/src/reactions.test.ts
.github/workflows/shared-ci.yml             # run shared + server typecheck/tests
```

## Task 1 — Shared Workspace Boundary

- Export rules and PRNG subpaths from `@mahjong-live/shared`.
- Add `server` workspace package depending on `@mahjong-live/shared: workspace:*`.
- Keep TypeScript strict and ESM, matching the shared package.

## Task 2 — Viewer-safe Projection

- Define `RoundView`, `PlayerView`, `WallView`, sanitized phase types.
- Exact concealed tiles only for the viewer's own seat.
- Strip wall internals, hidden Ura, opponent Furiten and reaction claim arrays.
- Attach legal actions only for the current viewer and only if that viewer has not already responded in the current reaction window.
- Unit-test serialization to prove hidden physical IDs/tiles are not reachable through opponent/spectator views.

## Task 3 — Lobby / Seat Ownership

- `AuthoritativeRoom` starts in lobby.
- Join first free seat or requested free seat; reject duplicates/full room.
- Ready state per seat.
- First joined client is host; only host may start.
- Start requires four occupied + ready seats and explicit seed; creates the authoritative `RoundState`.

## Task 4 — Versioned Commands / Idempotency

- Envelope: `commandId`, `expectedVersion`, `command`.
- Reject stale version, unknown client, wrong-seat action, client `resolve-reactions`.
- Cache bounded command receipts by `(clientId, commandId)`; duplicate returns same semantic result without mutating room.
- Public transition increments version and appends authoritative engine events to an internal log.

## Task 5 — Multiplayer Reaction Barrier

- Detect eligible reaction seats using `getLegalActions` at reaction-window entry.
- Store `{ phaseVersion, eligibleSeats, respondedSeats }` outside `RoundState`.
- Claims call the engine immediately but stay hidden and do not increment public version.
- `pass` marks only server response state.
- When all eligible seats responded, call `resolve-reactions`, increment public version, record only the resolved public transition.
- If a newly-created reaction window has zero eligible seats, auto-resolve immediately.
- Regression tests: simultaneous double Ron, Ron vs Pon, Pon vs Chi, all-pass, stale late response, duplicate command.

## Task 6 — Room Manager

- Create/get/list/remove in-memory rooms.
- IDs supplied/generated by the transport layer; Plan 8 manager validates uniqueness.
- No database or WebSocket dependency yet.

## Verification

- Existing shared engine suite remains green.
- Server tests cover privacy, authorization, idempotency, optimistic versioning, reaction barrier and deterministic start.
- `pnpm --filter @mahjong-live/shared typecheck`
- `pnpm --filter @mahjong-live/shared test`
- `pnpm --filter @mahjong-live/server typecheck`
- `pnpm --filter @mahjong-live/server test`
