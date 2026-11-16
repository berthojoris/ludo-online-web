import { CollapseIcon, ExpandIcon } from '@/Components/Game/Icons';
import { useCallback, useEffect, useState } from 'react';

type FullscreenDocument = Document & {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenRoot = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

function isFullscreenActive(): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    const doc = document as FullscreenDocument;

    return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/**
 * Toggles the browser fullscreen mode so the board can use the whole screen.
 * The same button (or Escape) brings the app back to its default window.
 */
export default function FullscreenToggle({
    className,
}: {
    /** Replaces the default round button styling when provided. */
    className?: string;
}) {
    const [supported, setSupported] = useState(false);
    const [active, setActive] = useState(false);

    useEffect(() => {
        const doc = document as FullscreenDocument;
        const enabled = Boolean(
            doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled,
        );

        setSupported(enabled);
        setActive(isFullscreenActive());

        if (!enabled) {
            return;
        }

        const onChange = () => setActive(isFullscreenActive());

        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);

        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    const toggle = useCallback(async () => {
        const doc = document as FullscreenDocument;
        const root = document.documentElement as FullscreenRoot;

        try {
            if (isFullscreenActive()) {
                if (doc.exitFullscreen) {
                    await doc.exitFullscreen();
                } else {
                    await doc.webkitExitFullscreen?.();
                }
            } else if (root.requestFullscreen) {
                await root.requestFullscreen({ navigationUI: 'hide' });
            } else {
                await root.webkitRequestFullscreen?.();
            }
        } catch {
            // Browsers reject the request outside a user gesture or in
            // embedded frames; keep the button in sync with reality.
            setActive(isFullscreenActive());
        }
    }, []);

    if (!supported) {
        return null;
    }

    const label = active ? 'Keluar dari layar penuh' : 'Masuk layar penuh';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={
                className ??
                'border-line text-ink-muted hover:text-ink grid h-8 w-8 place-items-center rounded-full border bg-white transition'
            }
        >
            {active ? (
                <CollapseIcon className="h-4 w-4" />
            ) : (
                <ExpandIcon className="h-4 w-4" />
            )}
        </button>
    );
}
