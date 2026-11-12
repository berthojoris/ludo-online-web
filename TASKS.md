# TASKS — Executable Work Breakdown

Status legend: `[ ] WAIT`, `[x] DONE`. No implementation work is claimed complete by this planning document.

## Product and decisions
- [x] P0 Approve `GAME_RULES.md` open ruleset decisions.
- [ ] P0 Define guest account linking, session lifetime and user privacy.
- [ ] P0 Agree launch regions, languages, retention and legal requirements.
- [ ] P0 Define target device list and minimum browser versions.

## Foundation
- [ ] P0 Initialize Laravel + Inertia React TypeScript repository.
- [ ] P0 Configure lint, formatter, PHPStan/Larastan, Pest/PHPUnit, frontend tests.
- [ ] P0 Configure MySQL, Redis, Reverb, Horizon, Forge staging.
- [ ] P0 Implement CI pipeline and secure environment management.

## Design and PWA
- [ ] P0 Build premium light design tokens and responsive AppShell.
- [ ] P0 Build home, matchmaking, room lobby and gameplay layout.
- [ ] P0 Implement 15×15 Pixi board and token art asset atlas.
- [ ] P0 Implement manifest, service worker, offline banner and update handling.
- [ ] P0 Test iOS/Android install and safe-area layouts.

## Game engine
- [ ] P0 Define immutable board fixture, safe cells, start positions and finish lanes.
- [ ] P0 Implement pure PHP rules engine and versioned ruleset.
- [ ] P0 Implement legal moves, capture, extra turns and finish.
- [ ] P0 Implement server dice CSPRNG and deadline enforcement.
- [ ] P0 Write unit/property-based tests for all rules.

## Backend and realtime
- [ ] P0 Create schema, indexes and constraints.
- [ ] P0 Implement room create/join/ready/start and queue matching.
- [ ] P0 Implement atomic match action transaction and idempotency.
- [ ] P0 Implement transactional outbox and retry publisher.
- [ ] P0 Implement private Reverb channel auth and transition broadcasts.
- [ ] P0 Implement snapshot API, version-gap recovery and resume.

## Animation and sensory
- [ ] P0 Build animation director, queue, cancellation and cleanup.
- [ ] P0 Implement dice tumble with server result.
- [ ] P0 Implement per-cell token hop and shadow.
- [ ] P0 Implement capture impact and return-to-base arc.
- [ ] P0 Implement finish/victory sequences and particle caps.
- [ ] P0 Implement SFX manager, user gesture unlock and mute setting.
- [ ] P0 Implement feature-detected haptics and reduced-motion.
- [ ] P0 Profile and optimize mid-range mobile devices.

## QA and operations
- [ ] P0 Implement E2E 2–4 player flows and concurrency tests.
- [ ] P0 Test reconnect, out-of-order/duplicate events and browser background.
- [ ] P0 Configure logs, alerts, dashboards and feature flags.
- [ ] P0 Perform security review and abuse prevention tests.
- [ ] P0 Verify backups, restoration and rollback runbook.
- [ ] P0 Pilot release with go/no-go checklist.

## Post-MVP
- [ ] P1 Match history and leaderboard.
- [ ] P1 Friends and invitations.
- [ ] P1 Report/block player and optional moderated text chat.
- [ ] P2 Tournament and seasonal cosmetics.
