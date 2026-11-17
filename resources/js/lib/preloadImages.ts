const preloaded = new Set<string>();

/**
 * Downloads and decodes images ahead of time, so art that first appears
 * mid-animation (such as the capture skill giant) does not stall a frame.
 */
export function preloadImages(urls: string[]): void {
    if (typeof window === 'undefined') {
        return;
    }

    for (const url of urls) {
        if (!url || preloaded.has(url)) {
            continue;
        }

        preloaded.add(url);

        const image = new Image();
        image.decoding = 'async';
        image.src = url;
        image.decode().catch(() => preloaded.delete(url));
    }
}
