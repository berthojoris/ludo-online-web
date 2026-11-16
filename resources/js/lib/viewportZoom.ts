import { router } from '@inertiajs/react';

const VIEWPORT_SELECTOR = 'meta[name="viewport"]';
const FULL_SCALE = 1;
const SCALE_TOLERANCE = 0.01;
const SNAP_BACK_MS = 100;

let pristineViewportContent: string | null = null;
let snapBackTimer: number | null = null;

function viewportMeta(): HTMLMetaElement | null {
    return document.querySelector<HTMLMetaElement>(VIEWPORT_SELECTOR);
}

function isPageScaled(): boolean {
    const viewport = window.visualViewport;

    return Boolean(
        viewport && Math.abs(viewport.scale - FULL_SCALE) > SCALE_TOLERANCE,
    );
}

/**
 * Snaps the visual viewport back to 100%.
 *
 * iPadOS Safari keeps the zoom level where the last gesture left it, and an
 * Inertia visit never reloads the document, so a room can open already zoomed
 * in until the player pinches out. Capping the maximum scale forces WebKit to
 * re-evaluate the viewport at 100%; the pristine viewport string is restored
 * straight away, so two-finger pinch zoom keeps working.
 */
function resetPageZoom(): void {
    const meta = viewportMeta();

    if (!meta || snapBackTimer !== null || !isPageScaled()) {
        return;
    }

    if (pristineViewportContent === null) {
        pristineViewportContent = meta.content;
    }

    const contentWithoutMaximumScale = pristineViewportContent.replace(
        /\s*,\s*maximum-scale=[^,\s]+/gi,
        '',
    );

    meta.content = `${contentWithoutMaximumScale}, maximum-scale=1`;

    snapBackTimer = window.setTimeout(() => {
        snapBackTimer = null;
        meta.content = pristineViewportContent ?? meta.content;
    }, SNAP_BACK_MS);
}

function scheduleZoomReset(delay = 0): void {
    window.setTimeout(() => {
        window.requestAnimationFrame(resetPageZoom);
    }, delay);
}

/**
 * Keeps every screen at the intended 100% scale on iPad and other touch
 * browsers, where a focused text field, a double tap or a rotation can leave
 * the page zoomed in for the next screen.
 */
export function installViewportZoomGuard(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    router.on('navigate', () => scheduleZoomReset());
    window.addEventListener('orientationchange', () =>
        scheduleZoomReset(SNAP_BACK_MS),
    );
    window.addEventListener('pageshow', () => scheduleZoomReset(SNAP_BACK_MS));

    // A text field can leave iOS zoomed in after the keyboard closes.
    document.addEventListener('focusout', () =>
        scheduleZoomReset(SNAP_BACK_MS),
    );
}
