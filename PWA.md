# PWA — Android/iOS Installability and Offline Strategy

## 1. PWA baseline
- Valid web app manifest: name, short_name, icons (192/512 and maskable), start_url, scope, display standalone, theme/background colors.
- HTTPS, responsive viewport, iOS home screen metadata where appropriate.
- Service worker via Vite PWA Plugin/Workbox, with explicit update policy.
- App shell cache for navigational experience; game requires live server.

## 2. Caching matrix
| Resource | Strategy |
|---|---|
| Fingerprinted JS/CSS | Cache-first with revisioned assets |
| Texture atlas, sound assets | Cache-first, versioned and size-limited |
| Home/profile API | Network-first with bounded cache where safe |
| Match snapshot | Network-only, no stale competitive state |
| Roll/move/resign | Network-only; never queue offline |
| Reverb WebSocket | Online-only |

## 3. Offline and resume
- When offline: freeze inputs, show connection status and last-known board as non-authoritative visual reference.
- On network return: reconnect and GET snapshot, cancel stale animation timelines, restore current turn/deadline.
- On `visibilitychange` resume: resync even if WebSocket appears connected.
- Avoid automatic service-worker activation during live match; prompt to reload after match or use carefully coordinated update policy.

## 4. Mobile UX
- CSS safe-area insets for notch, status bar and home gesture.
- Board square and responsive at 320–430 CSS px, tablet and desktop.
- Prevent accidental scroll during board gestures; preserve accessibility and back navigation.
- Touch targets and focus states for controls; orientation changes without losing match.

## 5. Platform limitations
- iOS installation flow differs from Android; provide contextual Add to Home Screen help.
- Browser/PWA background timers and audio are not reliable; server deadlines remain authoritative.
- Vibration API is not broadly supported on iOS Safari; no-op when unavailable.
- Web push is optional post-MVP and depends on platform permissions/requirements.
- No microphone permission is required or requested.

## 6. PWA acceptance
- Install on representative Android Chrome and iOS Safari Home Screen.
- Open standalone; deep link to authorized room; handle expired code.
- Update service worker without corrupting an active match.
- Offline banner and reconnection work; no offline replay of moves.
- App usable after browser eviction/restart with fresh authenticated snapshot.
