# ANIMATION — PixiJS + GSAP Premium Motion Specification

## 1. Baseline
Preset **Premium Smooth**. SFX enabled by default subject to user gesture/browser policies. Haptics enabled as preference where supported. Target 60 FPS, graceful 30 FPS, respect reduced-motion. No live voice.

## 2. Separation of concerns
- `GameStateSynchronizer`: holds authoritative snapshots, event version, dedupe and recovery.
- `GameAnimationDirector`: schedules visual sequences, cancellation, fast-forward and interruption.
- `BoardRenderer`/`TokenRenderer`/`DiceRenderer`/`ParticleRenderer`: PixiJS sprites, coordinate transforms, texture atlas.
- `SoundEffectManager`: pooled SFX; unlock on user gesture.
- `HapticManager`: feature-detect `navigator.vibrate`; unsupported iOS gracefully no-ops.
- GSAP animates visual properties; never calls gameplay mutations.

## 3. Animation event descriptor
```ts
type VisualEvent = {
  eventId: string; actionId: string; stateVersion: number;
  kind: 'dice.rolled'|'token.moved'|'token.captured'|'token.finished'|'match.finished';
  payload: unknown; serverTimestamp: string;
};
```
Each descriptor must be derived from validated server state, with deterministic path and final state. If event is stale, skip playback and reconcile.

## 4. Dice roll
- `idle → pending → rolling → settling → completed`.
- On tap: 100ms tactile button feedback, immediately disable duplicate action.
- After server result: 900–1200ms die lift, tumbles, 1–2 bounces and final pip face matching server value.
- Suggested phases: anticipation 0–150ms; tumble 150–750ms; bounce 750–950ms; settle 950–1150ms.
- Use 2.5D pre-rendered faces/rotation or a carefully benchmarked 3D die; never generate outcome on client.
- Accessibility: announce final number via live region without repetitive intermediate announcements.
- SFX: dice shake/roll, soft settle. Haptic: short roll tap, not every face change.

## 5. Token movement
- Map authoritative token progress to fixed 15×15 board path; convert grid centers to pixel coords via board scale.
- Animate **each cell** (110–150ms) using eased x/y plus vertical hop `-sin(pi*t)*height`; shadow scales/fades with height.
- Keep position interpolation and shadow in one animation owner to avoid tween conflict.
- For long sequences, cap visual duration by dynamically reducing per-step time, but preserve legible path.
- On landing: subtle squash/settle; avoid jarring overshoot.
- Legal token choices pulse at low amplitude, never confuse active state.
- Overlapping tokens: temporary fan layout during selection, restore stack on end.

## 6. Capture / kill
- After attacker reaches target: 250–400ms impact (scale 1.0→1.08→1.0), tiny camera-less shake on victim, restrained particles.
- Victim returns via quadratic Bézier to its **assigned** base slot (450–700ms), short trail, landing bounce.
- SFX impact + swoosh + soft base landing; haptic capture pulse (if supported).
- `captureSequenceId` prevents duplicate visual effects across separate semantic event notifications.
- Server state is already committed; no waiting for victim animation to finalize turn.

## 7. Finish and victory
- Token enters final home: 600–900ms, gentle scale down, glow, small celebratory particles.
- Match victory: 1500–2500ms confetti and results reveal; optional skip and reduced-motion alternative.
- Never render winner before receiving authoritative `match.finished` event.

## 8. Queue, interruption, recovery
- Queue by stateVersion and actionId, dedupe eventId.
- Process one position-owning timeline per token; parallel independent cosmetic effects allowed.
- On missed version, tab resume, reconnect or timer drift: cancel pending timelines, fetch snapshot, set all sprites to canonical coordinates, then re-enable input.
- If client lags > configured animation backlog threshold, fast-forward cosmetic sequences rather than block turn controls.
- On component unmount: `timeline.kill()`, remove event listeners, destroy pooled emitters appropriately.

## 9. Sound/haptic
| Event | SFX | Haptic suggestion |
|---|---|---|
| Roll | shake + tumble | 15ms |
| Token hop | soft tap, throttled | optional 8ms, not each rapid step |
| Capture | impact + swoosh | [30,20,40]ms |
| Finish | chime | [20,30,20]ms |
| Victory | short celebration | short capped pattern |
Browser gesture/audio unlock required. User mute preference persists. Avoid copyrighted sounds without license.

## 10. Performance budgets and instrumentation
- Target frame budget 16.7ms at 60Hz; measure actual long frames and p95 frame time.
- Use texture atlases, object pooling, capped particle count, lazy-load celebration assets, adaptive renderer resolution.
- Avoid React rerender every frame; React handles controls, Pixi handles board.
- Test reduced-motion, low-power mode, orientation changes and browser background.
- Log animation queue depth and resync count without leaking personal data.

## 11. Acceptance tests
- Dice always lands on server result; 100 consecutive simulated rolls match payload.
- Move follows each server path cell exactly; no teleport under normal playback.
- Captured token returns to correct slot once, even if event duplicated.
- Reconnect mid-hop restores authoritative position.
- Turn timer never depends on completion of visual timeline.
- Low-end device remains playable with adaptive effect reduction.
