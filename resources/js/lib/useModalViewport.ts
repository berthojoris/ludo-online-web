import { CSSProperties, useEffect, useState } from 'react';

type ViewportFrame = {
    top: number;
    left: number;
    width: number;
    height: number;
};

function readVisualViewport(): ViewportFrame | null {
    const viewport = window.visualViewport;

    if (!viewport) {
        return null;
    }

    return {
        top: viewport.offsetTop,
        left: viewport.offsetLeft,
        width: viewport.width,
        height: viewport.height,
    };
}

function sameFrame(a: ViewportFrame | null, b: ViewportFrame | null): boolean {
    return (
        a === b ||
        (a !== null &&
            b !== null &&
            a.top === b.top &&
            a.left === b.left &&
            a.width === b.width &&
            a.height === b.height)
    );
}

/**
 * Pins a modal overlay to the visual viewport, the part of the page that is
 * actually on screen.
 *
 * Android Chrome attaches `position: fixed; inset: 0` to the layout viewport,
 * so when the keyboard opens or the page is zoomed/panned the dialog stays
 * centred on an area the user cannot see. Following `window.visualViewport`
 * keeps the dialog centred and fully inside the visible screen instead.
 */
export function useModalViewport(active: boolean): CSSProperties | undefined {
    const [frame, setFrame] = useState<ViewportFrame | null>(null);

    useEffect(() => {
        const viewport = window.visualViewport;

        if (!active || !viewport) {
            setFrame(null);

            return;
        }

        let animationFrame = 0;

        const sync = () => {
            const next = readVisualViewport();

            setFrame((current) => (sameFrame(current, next) ? current : next));
        };

        const scheduleSync = () => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(sync);
        };

        sync();
        viewport.addEventListener('resize', scheduleSync);
        viewport.addEventListener('scroll', scheduleSync);
        window.addEventListener('orientationchange', scheduleSync);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            viewport.removeEventListener('resize', scheduleSync);
            viewport.removeEventListener('scroll', scheduleSync);
            window.removeEventListener('orientationchange', scheduleSync);
        };
    }, [active]);

    if (!active || !frame) {
        return undefined;
    }

    return {
        top: frame.top,
        left: frame.left,
        right: 'auto',
        bottom: 'auto',
        width: frame.width,
        height: frame.height,
    };
}

/**
 * Touch-first devices open the on-screen keyboard when a text field gets
 * focus, which pans and may zoom the page. Dialogs skip auto-focusing text
 * fields there so they open centred; the user taps the field to type.
 */
export function hasCoarsePointer(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches
    );
}
