import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query on the client. Returns whether the query
 * currently matches, updating on change.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia
            ? window.matchMedia(query).matches
            : false,
    );

    useEffect(() => {
        const media = window.matchMedia(query);
        const update = () => setMatches(media.matches);

        update();
        media.addEventListener('change', update);

        return () => media.removeEventListener('change', update);
    }, [query]);

    return matches;
}
