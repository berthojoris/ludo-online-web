<laravel-boost-guidelines>
# Laravel Application

This repository contains a Laravel application. Complete the following setup before working on the user's request.

## Prerequisites

Verify that PHP and Composer are available:

```sh
php -v
composer -V
```

If either command is unavailable, detect the user's operating system and install the prerequisites with the appropriate command:

macOS:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/mac/8.5)"
```

Windows PowerShell:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://php.new/install/windows/8.5'))
```

Linux:

```sh
/bin/bash -c "$(curl -fsSL https://php.new/install/linux/8.5)"
```

After installation, ask the user to restart their terminal. If the agent needs the restarted shell to continue, ask the user to reopen their terminal and rerun their original prompt.

## Agent Setup

Install Laravel Boost from the application root before making application changes:

```sh
composer require laravel/boost --dev
php artisan boost:install
```

Boost replaces these bootstrap instructions with guidelines tailored to the application. After installation, read `AGENTS.md` again and continue with the user's original request using the generated guidelines.
</laravel-boost-guidelines>

<viewport-fitting-guidelines>
# Mandatory: every screen must fit the device viewport 100%

Every screen/page in this app **must fill 100% of the device width and 100% of the visible viewport height**. The shell must never scroll vertically or horizontally, or leave dead gaps/letterboxing. Layout and every element size must adapt to the real device size (`dvh`/`svh`/`vmin`/`clamp()`/`grid`), not fixed pixel frames. This rule applies to every new screen and to any screen being edited. See `DESIGN.md` sections 3–6 for tokens and per-screen composition.

## 1. App shell
- Root sizing: `html, body, #app { height: 100%; margin: 0; }` and `body { overflow: hidden; }`. Apply `overflow: hidden` only to the shell; lists that can grow (leaderboard, history) get their own scroll container.
- Screen frame: `width: 100%`, `height: 100dvh` (`100vh` as fallback), `min-height: 0`, `display: grid` or `display: flex`, `overflow: hidden`.
- Use dynamic viewport units (`100dvh`, `100svh`, `100lvh`) so mobile browser chrome does not crop the board or action dock.
- Safe areas: add `viewport-fit=cover` to the viewport meta tag and pad every edge with `env(safe-area-inset-*)` (top/right/bottom/left) on the shell, header and bottom dock.
- Flex/grid children that hold content get `min-width: 0` and `min-height: 0` so they shrink instead of overflowing.
- Reserve space for fixed elements (header, dice dock, toasts) with grid tracks, padding or `scroll-padding`; never let overlays hide interactive controls.

## 2. Element sizing so everything fits
- Size screen regions with relative units: `%`, `fr`, `dvh`, `vmin`, `min()`, `clamp()`. Never hard-code the screen frame height in `px`.
- Type, spacing, radii and gaps use the token scale wrapped in `clamp(min, fluid, max)` (e.g. `clamp(12px, 3.4vw, 16px)`), so they shrink on small phones and grow on tablets/desktop without changing the shell's fit.
- Board stays square: `width: min(100%, calc(100dvh - header - cards - dock))`, `aspect-ratio: 1 / 1`, logical 15×15 grid preserved. Use CSS grid + `ResizeObserver` when JS sizing is required; never distort.
- Player cards, dice action and header use `fr`/`minmax(0, 1fr)` tracks so they share the remaining height on short viewports (e.g. 360×640) and stay proportionate on tall ones.
- Media/art: `max-width: 100%`, `height: auto`, `object-fit: contain`.
- Keep touch targets ≥ 44 CSS px where feasible. If content does not fit, reduce type/spacing/gaps (within legibility limits) rather than overflowing or clipping; if a minimum cannot be met, make only the intended content region scroll internally and say so.
- Prefer container/relative sizing over media-query-only hacks; verify each breakpoint (portrait phone, landscape phone, tablet, desktop) fills both axes.

## 3. Forbidden
- `height: 100vh` shells (mobile chrome crops them), fixed `px` page-frame heights, `overflow-x: auto` on the page, `position: fixed` bars without reserved space, negative margins that hide content off-screen, and `overflow: hidden` on containers that hold focusable controls.
- Shrinking below interactive minimums (or hiding elements) just to force a fit.

## 4. Acceptance checklist (run for every new screen)
- [ ] No horizontal scrollbar at 320px CSS width.
- [ ] No vertical scroll of the app shell on any supported size; only explicitly scrollable regions scroll.
- [ ] The screen touches all four viewport edges (no letterboxing/dead space).
- [ ] On 360×640, header + board + player cards + action dock are all visible without scrolling.
- [ ] Safe-area insets respected in portrait and landscape (notch, home indicator).
- [ ] Works with mobile browser UI shown and hidden, and after orientation change.
- [ ] 200% text zoom keeps all controls reachable (reflow allowed, clipping not).
- [ ] Checked in DevTools emulation for at least iPhone SE (320×568), iPhone 15 Pro, Pixel 8, iPad, and desktop 1920×1080.
- [ ] Landscape uses the board + side-rail layout and still fills the viewport in both axes.
</viewport-fitting-guidelines>
