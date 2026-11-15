import { router } from '@inertiajs/react';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Blocks accidental navigation while a match is running.
 *
 * - Browser back/forward is trapped by parking a sentinel history entry on the
 *   current URL, so the first "back" stays on the same page and only opens the
 *   confirmation dialog.
 * - Refresh and tab close are caught with `beforeunload`, which the browser
 *   always shows with its own native confirm dialog.
 * - In-app links call `blockLink` so they go through the same dialog.
 *
 * Inertia remounts the page component when it restores a history entry, so the
 * "dialog is open" flag lives outside React state. Otherwise the confirmation
 * would flash and close on the first back press.
 */
type Store = {
    key: string | null;
    open: boolean;
};

const store: Store = { key: null, open: false };
const listeners = new Set<() => void>();

function publish(open: boolean) {
    if (store.open === open) {
        return;
    }

    store.open = open;
    listeners.forEach((listener) => listener());
}

function forget() {
    store.key = null;
    publish(false);
}

export function useGameExitGuard(
    active: boolean,
    destination: string,
    guardKey: string = destination,
) {
    const [open, setOpen] = useState(
        store.key === guardKey ? store.open : false,
    );
    const allowRef = useRef(false);
    const destinationRef = useRef(destination);
    destinationRef.current = destination;

    useEffect(() => {
        const listener = () => {
            setOpen(store.key === guardKey ? store.open : false);
        };

        listeners.add(listener);
        listener();

        return () => {
            listeners.delete(listener);
        };
    }, [guardKey]);

    const show = useCallback(() => {
        store.key = guardKey;
        publish(true);
    }, [guardKey]);

    useEffect(() => {
        if (!active) {
            if (store.key === guardKey) {
                publish(false);
            }

            return;
        }

        allowRef.current = false;

        const pushGuard = () => {
            try {
                window.history.pushState(
                    { ...(window.history.state ?? {}), ludoExitGuard: true },
                    '',
                    window.location.href,
                );
            } catch {
                // Some embedded webviews refuse pushState; the beforeunload
                // guard below still covers refresh and close.
            }
        };

        pushGuard();

        const onPopState = () => {
            if (allowRef.current) {
                return;
            }

            // Re-park the entry so the URL never actually changes and open the
            // in-app confirmation instead.
            pushGuard();
            show();
        };

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (allowRef.current) {
                return;
            }

            event.preventDefault();
            event.returnValue = '';

            return '';
        };

        window.addEventListener('popstate', onPopState);
        window.addEventListener('beforeunload', onBeforeUnload);

        return () => {
            window.removeEventListener('popstate', onPopState);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, [active, guardKey, show]);

    // Leaving the guarded screen for good clears the pending confirmation.
    useEffect(() => {
        if (active) {
            return;
        }

        if (store.key === guardKey) {
            forget();
        }
    }, [active, guardKey]);

    const blockLink = useCallback(
        (event: MouseEvent<Element>) => {
            if (!active || allowRef.current) {
                return;
            }

            event.preventDefault();
            show();
        },
        [active, show],
    );

    const requestLeave = useCallback(() => {
        if (!active || allowRef.current) {
            return false;
        }

        show();

        return true;
    }, [active, show]);

    const cancel = useCallback(() => publish(false), []);

    const leave = useCallback(() => {
        allowRef.current = true;
        forget();
        router.visit(destinationRef.current);
    }, []);

    return { open, blockLink, requestLeave, cancel, leave };
}
