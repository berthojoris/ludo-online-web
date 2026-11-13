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
- [ ] Verified in a real browser via the **browse MCP** (section 5) at iPhone SE (320×568), iPhone 15 Pro, Pixel 8, iPad, and desktop 1920×1080 — DevTools emulation alone is not accepted.
- [ ] Landscape uses the board + side-rail layout and still fills the viewport in both axes.
- [ ] Measured `scrollHeight`/`scrollWidth` and PASS/FAIL evidence reported per viewport (no estimates).

## 5. Mandatory browser verification with the browse MCP

UI work is not complete until it has been validated in a real browser. Never claim a screen "fits" based only on source review, `curl`, or a successful `vite build`.

1. **Start the app**: `php artisan serve --host=127.0.0.1 --port=8000` and `npm run dev` (or `npm run build`), then note the URL.
2. **Open it with the browse MCP** (`browse` MCP server; in OpenCode Code Mode use `tools.browse.*` via `execute`). Use the real Chrome session: `page.goto`, `snapshot`, `page.evaluate`, and screenshots. Do not substitute static HTML fetches for a browser check.
3. **Measure in the live page, not from estimates**:
   - `document.documentElement.scrollHeight <= window.innerHeight`
   - `document.documentElement.scrollWidth <= window.innerWidth`
   - shell `scrollHeight === clientHeight` and `scrollWidth === clientWidth` (catches clipped/overlapping content)
   - main content bottom < footer top; the board/hero rect width === height (no distortion)
   - every CTA/modal trigger is in the DOM, visible, and has the correct accessible name and `href`
   - no console errors; the modal opens, closes with Escape, and returns focus to its trigger
4. **Resize/emulate at minimum**: 320×568, 360×640, 375×667, 390×844, 414×896, 768×1024, 1024×768, 1280×800, 1366×768, 1920×1080, plus phone landscape. Check portrait and landscape.
5. **Capture screenshots** at 320×568, a mid-size phone, and desktop, and report their paths together with a PASS/FAIL table of the measured numbers.
6. **If the browse MCP is unavailable**, say so explicitly. A headless Chrome/Playwright script may be used only as a documented fallback, and the report must name the tool that produced the evidence. Never fabricate browser results.
</viewport-fitting-guidelines>

<routing-guidelines>
# Routing rules — clean, server-backed URLs only

These rules apply to every screen, overlay, link, and state change in this Inertia + Laravel application.

## 1. Never use hash routing
- Do not use `window.location.hash`, `hashchange`, or `#` fragments for navigation, modals, tabs, filters, or any shareable UI state.
- Forbidden: `/#how-it-works`, `#how-it-works`, or equivalent hash-based routing.
- Required: a real path such as `/how-it-works`.
- A hash may only target an existing in-page element (for example `#main-content`), never represent a page or overlay.

## 2. Every routable UI state needs a named server route
- Register each page and deep-linkable overlay in `routes/web.php` with a name and a controller action, for example:
  `Route::get('/how-it-works', [PageController::class, 'howItWorks'])->name('how-it-works');`
- A direct visit, refresh, incognito visit, and shared link must render the same UI. The server must return the page with explicit props needed to restore the state (for example `howItWorksOpen => true`).
- Sync those props into local React state with an effect so Inertia back/forward navigation opens and closes the UI correctly.
- Do not use `window.history.pushState` or `replaceState` to invent a URL that the server does not also serve.
- Prefer Inertia `<Link>` or `router.visit()` so page props, history, scroll restoration, and the progress bar stay consistent.

## 3. Build and use URLs correctly
- Always call Ziggy `route('name')` in React when a named route exists. Do not hardcode paths in `href` values.
- Use query strings only for optional state (`/room?join=1`, filters, pagination). State that changes which screen is shown belongs in the path.
- Paths are lowercase, hyphenated, and have no trailing slash: `/how-it-works`, not `/HowItWorks`, `/how_it_works`, or `/how-it-works/`.
- Use links (`<Link>`/`<a>`) for navigation and buttons for actions. Any control that changes the URL must expose a real `href`.
- Closing an overlay must return to its parent route. Escape, backdrop click, the close button, and any navigation CTA must leave history in a valid state without stale overlay URLs.
- Add a feature test for every new public route: `assertOk`, Inertia component, and required props.
</routing-guidelines>
