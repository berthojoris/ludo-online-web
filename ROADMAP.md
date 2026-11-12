# ROADMAP — Milestones and Dependencies

**Planning estimate:** 5–10 weeks for a scoped MVP with an experienced small team, subject to scope, assets, staffing and real-device QA. Not a delivery commitment.

## Milestone M0 — Decisions and setup
- Confirm ruleset variants, guest identity, seat mapping, timeout/forfeit, deployment constraints.
- Repo bootstrap, CI, lint/static analysis, environments, coding conventions.
- Done when decisions are recorded and baseline app deploys to staging.

## M1 — Design system and PWA shell
- Design tokens, component library, home/lobby/game wireframes, manifest/service worker, responsive safe areas.
- Done when 320px portrait and desktop layouts pass visual review.

## M2 — Pure Ludo rules engine
- Board fixture, legal moves, dice RNG, turn state machine, capture/finish, property tests.
- Done when game rules conformance suite and edge cases pass.

## M3 — Persistence and room/match API
- DB migrations, guest/auth, rooms, quick-match, atomic actions, idempotency, outbox.
- Done when integration tests cover races and replay.

## M4 — Reverb multiplayer and recovery
- Private channels, transition envelopes, snapshot endpoint, reconnect and timer sync.
- Done when four-browser match survives disconnect and event duplication.

## M5 — Premium animation and polish
- Pixi board, dice roll, hop, capture, return, finish, victory, SFX/haptics, adaptive quality.
- Done when animation acceptance and representative device QA pass.

## M6 — Hardening and pilot
- Security audit, load tests, observability, backup restore, moderation basics, pilot release.
- Done when P0 release gates pass and runbooks are ready.

## Post-MVP candidates
Match history, leaderboard/rating, friends, text emotes/chat with moderation, seasonal cosmetics, spectator/tournaments. Explicitly no live voice in current plan.
