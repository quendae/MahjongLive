# Plan 13 — Single-player presentation timeline

Date: 2026-08-30
Branch: `plan13-presentation-timeline`

## Goal

Keep the engine deterministic and fast while allowing the browser client to present automated bot/system actions one at a time instead of jumping directly to the next human prompt.

## Scope

1. Single controller emits transient presentation frames after every accepted human/bot/system reducer action.
2. A frame contains the post-action `SingleGameState`, that action's events, and its trace entry. Frames are return metadata only and are never persisted in `SingleGameState`.
3. Client replays those frames at a user-selected speed: Slow / Normal / Fast / Instant.
4. During playback all gameplay input is locked; the final authoritative result is persisted immediately, so refresh/crash never rolls the game back to a presentation-only frame.
5. Each frame gets a short visible caption; bot draw identities remain hidden exactly as in the game log.
6. Result/choice overlays appear only after playback reaches the authoritative final prompt.
7. Preserve Plan 12 difficulty, advisor, onboarding and old-save compatibility.

## Validation

- frame sequence reproduces the same final state as ordinary drive output;
- trace/frame ordering matches reducer action ordering;
- bot concealed draw information is not added to presentation captions;
- existing deterministic JSON save tests remain green;
- full engine suite + client typecheck + production build green;
- no new dependencies / lockfile changes.
