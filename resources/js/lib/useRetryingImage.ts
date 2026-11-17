import { useCallback, useEffect, useRef, useState } from 'react';

/** Waits before each new attempt after a failed load. */
const RETRY_DELAYS_MS = [700, 2000, 5000, 12000];

type RetryState = {
    src: string;
    attempt: number;
    failed: boolean;
};

/**
 * Keeps an `<img>` from staying blank after one failed request.
 *
 * A broken image with an empty `alt` paints nothing, so a pion whose art
 * request failed (a dropped connection, or a proxy error such as Cloudflare's
 * 520) used to leave only its CSS shadow on the board for the rest of the
 * match. This retries with a fresh URL, because browsers never re-request an
 * unchanged `src`, and reports `failed` so callers can draw a fallback while
 * the art is missing.
 */
export function useRetryingImage(src: string) {
    const [state, setState] = useState<RetryState>({
        src,
        attempt: 0,
        failed: false,
    });
    const timerRef = useRef<number | null>(null);
    const current =
        state.src === src ? state : { src, attempt: 0, failed: false };

    useEffect(
        () => () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        },
        [src],
    );

    const onError = useCallback(() => {
        const attempt = current.attempt;

        setState({ src, attempt, failed: true });

        if (attempt >= RETRY_DELAYS_MS.length) {
            return;
        }

        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
        }

        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            setState((previous) =>
                previous.src === src
                    ? { src, attempt: attempt + 1, failed: true }
                    : previous,
            );
        }, RETRY_DELAYS_MS[attempt]);
    }, [src, current.attempt]);

    const onLoad = useCallback(() => {
        setState((previous) =>
            previous.src === src && previous.failed
                ? { ...previous, failed: false }
                : previous,
        );
    }, [src]);

    const separator = src.includes('?') ? '&' : '?';

    return {
        src:
            current.attempt === 0
                ? src
                : `${src}${separator}retry=${current.attempt}`,
        failed: current.failed,
        onError,
        onLoad,
    };
}
