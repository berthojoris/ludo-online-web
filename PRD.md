# Product Requirements Document — Ludo Arena

## 1. Executive summary
Ludo Arena is a polished, installable, mobile-first multiplayer Ludo PWA supporting 2–4 participants, online quick match, private invite-code rooms, smooth premium animation, sound effects, optional device haptics, reconnection and a fair server-authoritative rules engine. The interface uses a clean premium **light** visual system inspired by the user-provided board reference: large 15×15 four-color board, clear player cards, prominent roll button, minimal chrome. **No voice chat**.

## 2. Goals and non-goals
### Goals
- Complete legal online Ludo matches with deterministic, testable rules.
- Make actions visually satisfying: roll, move, capture, return-to-base, finish and victory.
- Provide safe, intuitive touch-first UX on Android/iOS PWA and desktop browsers.
- Survive packet loss, event duplication, disconnect and background/resume without state divergence.
- Ship with observability, moderation basics and accessible controls.
### Non-goals for MVP
- LiveKit, WebRTC, live voice or microphone access.
- Real-money betting, tokens redeemable for cash, gambling, NFTs.
- Offline multiplayer, cross-device account synchronization while offline.
- Spectator mode, clans, tournaments, complex cosmetics store, AI opponents (future candidates).

## 3. Personas
- Casual player: wants fast, friendly matches on phone.
- Friend-group organizer: creates room and shares code/link.
- Returning player: resumes match after network interruption.
- Competitive player (post-MVP): wants fair rating and match history.
- Operator: investigates failures and abuse without modifying results invisibly.

## 4. Success metrics (provisional, instrumented)
- ≥99.9% accepted match actions result in one durable transition and recoverable state.
- 0 server-side invalid moves accepted in rules conformance suite.
- ≥99% of controlled reconnect test scenarios recover the correct match state.
- Target 60 FPS on defined mid-range devices; graceful 30 FPS fallback.
- Crash-free sessions ≥99.5% during pilot; adjust after real baseline.
- Measure quick-match time p50/p95, match completion rate, abandonment and error rate.

## 5. MVP functional requirements
| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| FR-01 | Account and guest entry | P0 | Guest can play; authenticated account persists profile; identity cannot be forged |
| FR-02 | Home screen | P0 | Play Online, Create Room, Join Room visible and reachable |
| FR-03 | Private room | P0 | Secure short invite code, 2–4 seats, host controls, expiration |
| FR-04 | Quick matchmaking | P0 | Eligible users paired by mode/ruleset/region; no double assignment |
| FR-05 | Ready/start flow | P0 | Start only with valid seats; room locks before game start |
| FR-06 | Server dice | P0 | Server generates uniformly distributed 1–6 value with CSPRNG |
| FR-07 | Legal movement | P0 | Ruleset checks base entry, paths, safe cells, captures and finish |
| FR-08 | Turn timers | P0 | Server deadlines enforced, timeout policy versioned |
| FR-09 | Realtime | P0 | Authorized clients receive ordered/versioned events and snapshot recovery |
| FR-10 | Reconnect | P0 | Client rehydrates from snapshot and restores controls safely |
| FR-11 | Premium animation | P0 | Roll, hop, capture, return, finish, victory; skip on stale state |
| FR-12 | SFX & haptics | P0 | Toggleable; respects platform limitations and reduced motion |
| FR-13 | PWA install | P0 | Manifest, icons, service worker, safe areas, standalone UI |
| FR-14 | Match result | P0 | Winner/placements determined on server; idempotent finalization |
| FR-15 | Match history | P1 | Recent match list and details available |
| FR-16 | Leaderboard/rating | P1 | Fair and explainable rating, season policy documented |
| FR-17 | Friends/invites | P1 | Invite notifications, privacy controls |
| FR-18 | Abuse reporting | P1 | Report player with match reference; operator review |
| FR-19 | Accessibility | P0 | Contrast, non-color status cues, keyboard basics, reduced motion |
| FR-20 | Text chat/emotes | P1 | Optional; if shipped, moderation and rate limits required |

## 6. End-to-end journeys
### Quick match
Open app → guest/login → Play Online → matchmaking queue → room found → ready → game starts → server determines turns → actions and animations → results → rematch or home.
### Private match
Create Room → choose mode/ruleset → share link/code → players join → ready → host starts (or auto-start) → play → results.
### Reconnect
Disconnect detected → controls disabled and connection banner → exponential backoff reconnect → authenticated snapshot fetch → discard obsolete animation queue → restore correct board and deadline → continue.
### Abandonment
Leave confirmation → server marks disconnection/forfeit according to ruleset → match continues or terminates consistently.

## 7. Screens
- Splash/loading; onboarding/guest/login; home; quick-match searching; room creation; join room; lobby; gameplay; pause/settings; connection-loss overlay; results; profile; match history; leaderboard; report modal; error/maintenance; install help.

## 8. UX requirements
- Portrait first; board always square and never clipped; landscape uses two-column composition.
- Players identifiable by name, avatar, icon and color; active turn visibly indicated.
- Dice button large and disabled while request pending or not your turn.
- A token is selectable only if legal; invalid attempts give non-disruptive feedback.
- No voice/microphone UI.
- Animation effects never hide critical match information longer than necessary.

## 9. Nonfunctional requirements
- Transport: HTTPS/WSS; private channel authorization; server-authoritative mutations.
- Availability target to be finalized after hosting/SLO budget; instrument first.
- p95 action API latency initial target <200 ms under pilot load and local-region network, excluding animation; measure before promise.
- State recovery should not require replaying all animations.
- Asset budget and startup performance measured on representative Android/iOS devices.
- Data minimization, retention policy, abuse controls, and backup restoration tests.

## 10. Explicit acceptance scenarios
1. 4 players join; only current player can roll; simultaneous duplicate roll yields exactly one accepted result.
2. A move of 5 traverses exactly five legal route cells in UI and server state.
3. Landing on capturable opponent causes one capture and victim returns to its assigned base slot.
4. Landing on safe cell never captures when ruleset forbids it.
5. Finishing requires exact roll if ruleset configured; final match result stored once.
6. Reverb event duplicated/out of order → no duplicated move, snapshot recovery.
7. Player backgrounds PWA and resumes → deadline and positions correct, no stale action submission.
8. Audio/haptics toggles persist; unsupported vibration fails silently.
9. Slow Android renders without broken input or missing tokens.
10. Installed iOS PWA remains usable after orientation change and browser restart (online state recovery).

## 11. Launch gates
- All P0 tasks completed; no critical security issues; passing game rules property tests; multiplayer soak test; backup restore drill; mobile device QA; monitoring/alerts configured; documented rollback.

## 12. Product decisions & status
- **Decided:** Ruleset default locked (3x sixes = forfeit turn, auto-move single legal move, timeout = auto-skip with 3-strike forfeit, 2-player seating: opposite in quick match / free choice in private room).
- Guest account lifecycle and account linking.
- Rating algorithm, anti-collusion policy and public/private profile controls.
- Data retention, minimum age, regions and legal requirements.
