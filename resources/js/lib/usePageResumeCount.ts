import { useSyncExternalStore } from 'react';

let resumeCount = 0;
const listeners = new Set<() => void>();

function notifyResume(): void {
    resumeCount += 1;
    listeners.forEach((listener) => listener());
}

function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
        notifyResume();
    }
}

function handlePageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
        notifyResume();
    }
}

function subscribe(listener: () => void): () => void {
    if (listeners.size === 0) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pageshow', handlePageShow);
    }

    listeners.add(listener);

    return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            window.removeEventListener('pageshow', handlePageShow);
        }
    };
}

function getResumeCount(): number {
    return resumeCount;
}

function getServerResumeCount(): number {
    return 0;
}

/**
 * Counts how often the page came back on screen: the tab or app returned
 * from the background, or the page was restored from the back/forward
 * cache. Mobile engines may drop GPU textures while a page is hidden, so
 * components can use a change in this count to repaint fragile content.
 */
export function usePageResumeCount(): number {
    return useSyncExternalStore(
        subscribe,
        getResumeCount,
        getServerResumeCount,
    );
}
