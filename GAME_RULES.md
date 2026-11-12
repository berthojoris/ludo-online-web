# GAME_RULES — Versioned Ludo Rules Engine

## 1. Ruleset policy
Different Ludo variants exist. Implement `ruleset_id` and immutable `ruleset_version` stored on each match. **Proposed default**, pending product confirmation:
- 2–4 players, 4 tokens per player.
- Roll 6 to release token from base onto starting cell.
- A roll of 6 grants another turn unless overridden by three-consecutive-sixes rule.
- Landing on non-safe occupied enemy cell captures enemy token(s) according to chosen stack rule.
- Safe cells prevent capture.
- Exact roll required to finish.
- First player to finish all 4 tokens wins; optional full placements mode requires explicit policy.
- No legal move: turn advances (subject to extra-turn rules).
- Three consecutive sixes: forfeiture of current turn (hangus). The 3rd six cannot be moved and turn immediately advances to the next player.
- Single legal move auto-execution: When exactly one legal move exists (e.g. rolling 6 with only one token eligible to exit base and no tokens on track, or only one movable token on board), the engine auto-executes the move without waiting for manual player selection.
- Timeout & Disconnect policy: Auto-skip current turn when timer expires. If a player triggers 3 consecutive auto-skips, they are marked as FORFEITED to avoid stalling the match.
- 2-Player seating policy: In Quick Match, 2 players are seated in opposite quadrants (Red vs Yellow or Green vs Blue) for fair 26-cell distance symmetry. In Private Room, players may freely choose any seat/quadrant.

## 2. Board model
- Main ring 52 cells, 4 entry indices and 4 color-specific finish lanes; precise coordinate maps must be defined in fixture and reviewed against board art.
- Each token: `BASE(slot)`, `TRACK(progress)`, or `FINISHED`.
- Progress is player-relative, not arbitrary client (x,y).
- Canonical path fixture maps progress to logical cell id; server validates transition.
- Safe cells explicit, immutable per ruleset version.

## 3. State machine
`WAITING → READY → ACTIVE/AWAITING_ROLL → ACTIVE/AWAITING_MOVE → TURN_RESOLVING → ACTIVE/AWAITING_ROLL → COMPLETED` plus `ABORTED` and `FORFEITED` terminal states. `TURN_RESOLVING` may be an internal transition completed in one transaction rather than externally persisted.

## 4. Action contracts
- `roll`: only current player during AWAITING_ROLL; server generates CSPRNG integer 1..6; increments roll count.
- `move`: only current player during AWAITING_MOVE; token must belong to player; dice value and legal path already in state; no client-supplied outcome.
- `timeout`: system command, validates deadline and expected turn.
- `resign`: authenticated member, consistent terminal policy.

## 5. Engine API proposal
```php
interface RulesEngine {
    public function legalMoves(GameState $state, int $playerId): array;
    public function apply(GameState $state, GameCommand $command): TransitionResult;
}
```
TransitionResult includes next state, semantic events, and animation descriptor(s); never contains browser-derived coordinates as truth.

## 6. Invariants
- Exactly one current player in active match.
- Every token belongs to exactly one participant.
- Tokens cannot exceed final path progress.
- Only legal transitions alter state.
- State version strictly increments once per accepted command.
- Same idempotency key cannot apply two transitions.
- No capture on safe cells.
- Terminal match cannot accept roll/move.

## 7. Test matrix
- All dice values with base and finish edge cases.
- No-legal-move and multiple-legal-move scenarios.
- 6 grants extra turn; third 6 behavior.
- Safe cell collision; same-color stacks; opponent capture.
- Exact finish and overshoot rejection.
- 2/3/4-player seating and route rotation.
- Timer race vs manual roll; duplicate requests; simultaneous attempts.
- Randomized property-based sequences preserve invariants.

## 8. Decisions status
- **APPROVED:**
  - 3 Consecutive Sixes: Turn forfeited immediately (hangus), passes to next player.
  - Single legal move: Auto-execute move (including auto-release from base on 6).
  - Timeout / Disconnect: Auto-skip turn; 3 consecutive timeouts = Forfeit.
  - 2-Player seating: Opposite quadrants for Quick Match (Red vs Yellow / Green vs Blue); free quadrant choice for Private Room.
- **DEFAULT RULES CONFIRMED:**
  - Safe squares: 8 standard safe squares (4 starting cells + 4 star/shield cells at step 9 of each color).
  - Extra turn on capture: Yes, capturing an enemy token grants 1 extra roll.
  - Stacking: Tokens of the same color can share a cell (no blockades in MVP).
  - Turn timer: 15 seconds per action (roll/move).
- **OPEN:** match placements (rank 2-4 vs winner-takes-all), private-room rematch behavior. Never silently assume these in production.
