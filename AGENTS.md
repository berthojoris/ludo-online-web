<execution-guidelines>
# Execution rules — no browser tests, deliver correct and responsive code

## 1. No browser testing, ever
- Do **not** run any test on a browser in this project: no browse MCP session, no Playwright/headless Chrome, no DevTools device emulation, no screenshots, no live-browser measurement, no automated UI checks.
- Do not launch `php artisan serve` / `npm run dev` for the purpose of checking the UI, and do not claim viewport measurements or PASS/FAIL tables from a browser.
- Verification happens in source and in the build only: read the CSS/JSX, then run `npm run build` (and `php artisan test` when routes, controllers, or Blade/Inertia props change).

## 2. PASTIKAN KODE YANG DIHASILKAN SESUAI PERMINTAAN USER

**PASTIKAN KODE YG DIHASILKAN SESUAI PERMINTAAN USER DAN RESPONSIVE DI DEVICE KECIL, SEDANG DAN BESAR**

- Before writing code, restate the user's request as concrete requirements (screen, behavior, data, copy, interaction) and check every one of them against the delivered result.
- Implement exactly what was asked: do not rename, remove, redesign, or "improve" parts of the request, and do not leave a requested item unimplemented or partially implemented.
- If a requirement is ambiguous or conflicts with an existing rule, ask before building instead of guessing silently.
- Before finishing, walk through the request item by item and confirm in your summary that each one is present in the code.

## 3. Responsive on small, medium and large devices
- Every screen must work on small (≤ 360px wide phones), medium (tablets, 768–1024px), and large (desktop, ≥ 1280px, including 1920×1080) viewports — portrait and landscape.
- Use fluid sizing (`clamp()`, `%`, `fr`, `minmax(0, 1fr)`, `dvh`/`vmin`) instead of fixed `px` widths or frame heights, so layouts reflow instead of overflowing or clipping.
- Small devices: stack columns, keep touch targets ≥ 44px, let only the intended content region scroll, and never hide required controls to force a fit.
- Medium devices: use the extra width for side rails, multi-column grids, or larger board/hero areas rather than leaving dead space.
- Large devices: center the content with a sensible max-width, scale type/spacing with the `clamp()` token scale, and keep the screen filled in both axes with no letterboxing.
- Verify responsiveness by reviewing the breakpoints in the source (no browser run) and state which breakpoints were handled.
</execution-guidelines>

<laravel-guidelines>
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

## Laravel Boost

Do not install, use, or configure the `laravel/boost` package or its MCP server in this project. Do not run `boost:install` or generate Boost skills or guidelines here.
</laravel-guidelines>

<viewport-fitting-guidelines>
# Mandatory: every screen must fit the device viewport 100%

Every screen/page in this app **must fill 100% of the device width and 100% of the visible viewport height**. The shell must never scroll vertically or horizontally, or leave dead gaps/letterboxing. Layout and every element size must adapt to the real device size (`dvh`/`svh`/`vmin`/`clamp()`/`grid`), not fixed pixel frames. This rule applies to every new screen and to any screen being edited. See `DESIGN.md` sections 3–6 for tokens and per-screen composition.

> **Browser testing policy (overrides section 5 rules below):** do **not** run any browser testing, emulation, screenshots, or live-browser measurement for this project. No browse MCP session, no Playwright/headless Chrome script, no DevTools device emulation. Verify layout work by reading the CSS/JSX and running the build only. Section 4's browser items are informational requirements on the code, not actions to perform. See `<execution-guidelines>` at the top of this file: **PASTIKAN KODE YG DIHASILKAN SESUAI PERMINTAAN USER DAN RESPONSIVE DI DEVICE KECIL, SEDANG DAN BESAR**.

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

## 4. Acceptance checklist (review the code against this for every new screen)
- [ ] No horizontal overflow risk at 320px CSS width (no fixed-width content wider than the viewport).
- [ ] No vertical scroll of the app shell on any supported size; only explicitly scrollable regions scroll.
- [ ] The screen touches all four viewport edges (no letterboxing/dead space).
- [ ] On 360×640, header + board + player cards + action dock are all laid out without needing scroll.
- [ ] Safe-area insets applied in portrait and landscape (notch, home indicator).
- [ ] Layout survives mobile browser UI shown/hidden and orientation change (no `100vh` shell, no fixed `px` frames).
- [ ] 200% text zoom keeps all controls reachable (reflow allowed, clipping not).
- [ ] Landscape uses the board + side-rail layout and still fills the viewport in both axes.
- [ ] Small device review: works at ≤ 360px wide (stacked layout, touch targets ≥ 44px, no clipped controls).
- [ ] Medium device review: tablet widths 768–1024px use the extra space (side rail, multi-column, larger board) with no dead gaps.
- [ ] Large device review: ≥ 1280px (including 1920×1080) fills both axes, content centered with a sensible max-width, type/spacing scaled by `clamp()`.
- [ ] Output matches every item the user requested (screen, behavior, data, copy, interaction) — nothing missing, renamed, or silently redesigned.
- [ ] Sizing uses relative units so `scrollHeight`/`scrollWidth` stay within the viewport by construction.

## 5. Verification without a browser

Do **not** run browser testing for this project. There is no browse MCP step, no Playwright/headless Chrome fallback, no DevTools device emulation, and no screenshot capture. Do not claim measured `scrollHeight`/`scrollWidth` numbers, because no live browser was opened.

Instead, verify layout changes by:

1. **Reading the code**: confirm the shell uses `100dvh`, `min-height: 0`, `min-width: 0` on flex/grid children, `clamp()` sizing, no fixed `px` frame heights, and no `overflow-x` on the page.
2. **Running the build**: `npm run build` (and `php artisan test` when Blade/Inertia props or routes change). A successful build is the stopping point for UI work.
3. **Stating evidence honestly**: report what you checked in the source and in the build output. Never fabricate browser results or viewport measurements.
4. **Confirming the request and breakpoints**: in the final summary, list each requested item and where it is implemented, then name the small / medium / large breakpoints handled in the source. This is the project's substitute for a browser pass.
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
