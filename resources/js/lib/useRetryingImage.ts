import {
    SyntheticEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';

/** Waits before each new attempt after a failed load. */
const RETRY_DELAYS_MS = [700, 2000, 5000, 12000];

type RetryState = {
    src: string;
    attempt: number;
    loaded: boolean;
    failed: boolean;
};

/**
 * Keeps an `<img>` from staying blank while loading or after a failed request.
 *
 * A broken or pending image with an empty `alt` paints nothing, so a pion whose
 * art request failed (a dropped connection, a proxy error such as Cloudflare's
 * 520, or an error that fired before hydration) used to leave only its CSS
 * shadow on the board. This tracks `loaded` (including cached `complete`
 * images), retries with a fresh URL on failure or network recovery, and reports
 * `loaded`/`failed` so callers can draw a fallback whenever the art is missing.
 */
export function useRetryingImage(src: string) {
    const [state, setState] = useState<RetryState>({
        src,
        attempt: 0,
        loaded: false,
        failed: false,
    });
    const imgRef = useRef<HTMLImageElement | null>(null);
    const timerRef = useRef<number | null>(null);
    const current =
        state.src === src
            ? state
            : { src, attempt: 0, loaded: false, failed: false };

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => () => clearTimer(), [src, clearTimer]);

    const scheduleRetry = useCallback(
        (attempt: number) => {
            if (!src || attempt >= RETRY_DELAYS_MS.length) {
                return;
            }

            clearTimer();

            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                setState((previous) =>
                    previous.src === src && !previous.loaded
                        ? {
                              src,
                              attempt: attempt + 1,
                              loaded: false,
                              failed: true,
                          }
                        : previous,
                );
            }, RETRY_DELAYS_MS[attempt]);
        },
        [src, clearTimer],
    );

    const onError = useCallback(() => {
        if (!src) {
            return;
        }

        const attempt = current.attempt;

        setState({ src, attempt, loaded: false, failed: true });
        scheduleRetry(attempt);
    }, [src, current.attempt, scheduleRetry]);

    const onLoad = useCallback(
        (event?: SyntheticEvent<HTMLImageElement>) => {
            if (event && event.currentTarget.naturalWidth === 0) {
                onError();
                return;
            }

            clearTimer();
            setState((previous) =>
                previous.src === src
                    ? { ...previous, loaded: true, failed: false }
                    : { src, attempt: 0, loaded: true, failed: false },
            );
        },
        [src, clearTimer, onError],
    );

    // Catch images that already finished loading or failed before React attached handlers.
    useLayoutEffect(() => {
        const img = imgRef.current;

        if (!src || !img || !img.complete) {
            return;
        }

        if (img.naturalWidth > 0) {
            if (!current.loaded || current.failed) {
                clearTimer();
                setState({
                    src,
                    attempt: current.attempt,
                    loaded: true,
                    failed: false,
                });
            }
        } else if (!current.failed) {
            onError();
        }
    }, [src, current.attempt, current.loaded, current.failed, clearTimer, onError]);

    // If all backoff attempts were exhausted while offline, retry once the connection returns.
    useEffect(() => {
        if (!src || !current.failed || current.loaded) {
            return;
        }

        const retryNow = () => {
            if (
                document.visibilityState === 'hidden' ||
                timerRef.current !== null
            ) {
                return;
            }

            setState((previous) =>
                previous.src === src && !previous.loaded
                    ? {
                          src,
                          attempt: previous.attempt + 1,
                          loaded: false,
                          failed: true,
                      }
                    : previous,
            );
        };

        window.addEventListener('online', retryNow);
        document.addEventListener('visibilitychange', retryNow);

        return () => {
            window.removeEventListener('online', retryNow);
            document.removeEventListener('visibilitychange', retryNow);
        };
    }, [src, current.failed, current.loaded]);

    const separator = src.includes('?') ? '&' : '?';

    return {
        ref: imgRef,
        src:
            !src || current.attempt === 0
                ? src
                : `${src}${separator}retry=${current.attempt}`,
        loaded: Boolean(src) && current.loaded,
        failed: !src || current.failed,
        onError,
        onLoad,
    };
}
