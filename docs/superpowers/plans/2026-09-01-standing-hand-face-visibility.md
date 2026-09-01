# Plan 19 — Standing hand face visibility

## Goal
Match conventional digital riichi mahjong presentation: concealed hands stand on the narrow edge facing their owner, while river tiles lie flat face-up.

## Fix
- Keep the Plan 18 upright rack transforms and seat-relative yaw.
- Move the rendered front and rear face planes beyond the rounded/beveled tile shell so they are not occluded by the ivory body.
- Human bottom hand must visibly show tile symbols toward the player/camera side.
- Opponent racks remain concealed and show backs from the table/camera side.
- Rivers and open meld presentation remain flat.
- No rules, save-state, AI, or multiplayer changes.

## Validation
- client typecheck
- client production build
- shared test suite
