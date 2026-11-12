# DESIGN — Premium Light Casual Game UI/UX

## 1. Visual north star
Reference: user-provided screenshot of a light-theme Ludo board, large square board, 2 player cards above and below, restrained top bar, prominent blue Roll Dice button. Preserve this clean geometry; refine visual hierarchy, spacing, shadows and microinteractions. Avoid dark neon dashboards, excessive gradients, generic glassmorphism and crowded controls. No microphone icon.

## 2. Design principles
1. Board is hero (maximum practical size without clipping).
2. Colorful game objects on quiet neutral surfaces.
3. One dominant call to action at a time.
4. Motion is tactile, short, meaningful and interruptible.
5. Accessibility never depends solely on color or animation.

## 3. Design tokens (starting values, subject to visual QA)
```css
:root {
  --bg: #F7F8FA; --surface: #FFFFFF; --surface-muted: #F0F2F5;
  --ink: #202B3A; --ink-muted: #657185; --border: #E4E8EE;
  --primary: #2F6BEF; --primary-pressed: #2055C7;
  --red: #F04452; --blue: #2F80ED; --green: #20C66B; --yellow: #F4B915;
  --success: #16884D; --warning: #B66B05; --danger: #CC3341;
  --radius-sm: 10px; --radius-md: 16px; --radius-lg: 22px;
  --shadow-card: 0 6px 22px rgb(32 43 58 / 7%);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px;
}
```
Typography: use a licensed/self-hosted readable sans-serif (e.g., Inter or system UI); body 14–16 px, labels ≥12 px, major action 18–20 px. Confirm font licensing and loading performance. Tokens are **not** a WCAG compliance guarantee: test text/background combinations, especially yellow and muted text.

## 4. Gameplay layout
### Portrait
- Safe-area aware header: back, Ludo Arena, connection status, room code, settings.
- Two opponent cards above board; 1:1 board in center; two cards below.
- Bottom action dock: contextual roll button, optional text/emote control, sound/settings access.
- Player card: avatar, name, status text, active-turn ring, timer; no mic status.
- Keep ≥44 CSS px interactive touch targets where feasible; avoid overlapping OS gestures.
### Landscape/tablet/desktop
- Board left/center; right rail with players, dice and match timeline; max board size prevents overexpansion.
- Use CSS grid and ResizeObserver for board sizing; preserve board logical 15×15 coordinates.

## 5. Component inventory
- AppShell, GameHeader, ConnectionPill, PlayerCard, ActiveTurnRing, TurnTimer, BoardCanvas, TokenSprite, DiceAction, LegalMoveHighlight, MatchStatusBanner, RoomCodeShare, LobbySeat, ReadyButton, SettingsSheet, ResultsDialog, SoundToggle, ReducedMotionToggle, InstallPrompt, Toast, ConfirmLeaveDialog, ReportPlayerSheet.

## 6. Screen-specific requirements
### Home
Primary Play Online; secondary Create Room and Join Room; profile/leaderboard discoverable but not visually dominant.
### Matchmaking
Animated searching indicator, cancel, elapsed time, region/mode label; no fake opponent counts.
### Lobby
Seat cards, readiness, host badge, share link/code, rules summary, start gating.
### Gameplay
Board-first composition, no unnecessary panels; turn countdown and legal token emphasis.
### Results
Winner/placements, summary, rematch, return home; celebratory animation respects reduced motion.

## 7. Board art
- 15×15 logical grid; white paths with subtle outlines; home quadrants in red/green/blue/yellow.
- Tokens 2.5D: clean silhouette, soft highlight, distinct outline, dynamic soft shadow.
- Safe squares and finish path differentiated with shape/icons as well as color.
- When multiple tokens share a cell, fan/stack with selectable hit areas and clear count.
- Dice: premium rounded die with readable pips; result must remain unambiguous.

## 8. Motion language
- Tap response 80–140 ms; surface transitions 180–300 ms.
- Dice 900–1200 ms; token hop 110–150 ms/cell; capture 250–400 ms; return 450–700 ms; finish 600–900 ms; victory 1500–2500 ms.
- Use scale/position/opacity, soft shadow, restrained particles; no excessive shake.
- UI updates and authoritative timers do not wait for visual completion.
- See ANIMATION.md for implementation contracts.

## 9. Accessibility and localization
- Color-blind support: symbols/labels and outlines for player ownership.
- Screen-reader accessible non-canvas equivalent of game status, active player, dice result and available moves.
- Reduced motion follows prefers-reduced-motion unless explicitly overridden.
- SFX mute, haptic preference, clear focus rings, keyboard action equivalents.
- Initial languages: Indonesian and English; all strings externalized, dates/time localized.

## 10. UI acceptance checklist
- No horizontal overflow at 320px CSS viewport.
- Board never distorted; no touch conflict with browser back gesture.
- No clipping behind safe areas/notches/home indicator.
- Active turn visually distinct without depending solely on color.
- Loading, error, empty, offline and reconnect states designed.
- Voice/microphone indicators absent.
