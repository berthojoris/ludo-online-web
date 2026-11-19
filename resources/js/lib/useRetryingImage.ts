import { reportClientIssue } from '@/lib/clientIssues';
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

/**
 * A load that neither succeeds nor errors within this window is treated as
 * stalled (common on mobile proxies) so the retry path can take over.
 */
const STALL_TIMEOUT_MS = 10_000;

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
 * images), retries with a fresh URL on failure, stall or network recovery, and
 * only reports `loaded` once the frame is confirmed decoded, so callers can
 * draw a fallback whenever the art cannot actually paint.
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

    const reportedRef = useRef(false);

    useEffect(() => {
        reportedRef.current = false;
    }, [src]);

    /**
     * Pion art failures are otherwise silent (the seat-colored pin just stands
     * in), so report each one to the server log once per source URL to make
     * device-specific art problems diagnosable from production logs.
     */
    const reportFailure = useCallback((message: string) => {
        if (reportedRef.current) {
            return;
        }

        reportedRef.current = true;
        reportClientIssue(message, { source: 'pion-art', level: 'warning' });
    }, []);

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

        if (attempt >= RETRY_DELAYS_MS.length) {
            reportFailure(
                `Pion art failed to load after ${attempt} attempts: ${src.split('?')[0]}`,
            );
        }

        scheduleRetry(attempt);
    }, [src, current.attempt, scheduleRetry, reportFailure]);

    const markLoaded = useCallback(() => {
        clearTimer();
        setState((previous) =>
            previous.src === src
                ? { ...previous, loaded: true, failed: false }
                : { src, attempt: 0, loaded: true, failed: false },
        );
    }, [src, clearTimer]);

    /**
     * A `load` event only proves the bytes arrived. Engines can defer decoding
     * images that have never been painted (ours paints transparently while
     * `[data-failed]` is set), which leaves a "loaded" image drawing nothing.
     * decode() forces the frame to be decoded before `loaded` is reported, and
     * a decode failure routes back into the retry/fallback path instead.
     */
    const confirmDecoded = useCallback(
        (img: HTMLImageElement) => {
            if (typeof img.decode !== 'function') {
                markLoaded();
                return;
            }

            img.decode().then(markLoaded, () => {
                onError();
                reportFailure(
                    `Pion art frame failed to decode: ${src.split('?')[0]}`,
                );
            });
        },
        [markLoaded, onError, reportFailure, src],
    );

    const onLoad = useCallback(
        (event?: SyntheticEvent<HTMLImageElement>) => {
            const img = event?.currentTarget ?? imgRef.current;

            if (img && img.naturalWidth === 0) {
                onError();
                return;
            }

            if (img) {
                confirmDecoded(img);
            }
        },
        [onError, confirmDecoded],
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
                confirmDecoded(img);
            }
        } else if (!current.failed) {
            onError();
        }
    }, [
        src,
        current.attempt,
        current.loaded,
        current.failed,
        clearTimer,
        onError,
        confirmDecoded,
    ]);

    // A request stuck without a load or error event never retries on its own;
    // nudge it into the failed state so the backoff schedule takes over.
    useEffect(() => {
        if (!src || current.loaded || current.failed) {
            return;
        }

        const timer = window.setTimeout(() => {
            setState((previous) =>
                previous.src === src && !previous.loaded && !previous.failed
                    ? {
                          src,
                          attempt: previous.attempt + 1,
                          loaded: false,
                          failed: true,
                      }
                    : previous,
            );
        }, STALL_TIMEOUT_MS);

        return () => window.clearTimeout(timer);
    }, [src, current.attempt, current.loaded, current.failed]);

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
