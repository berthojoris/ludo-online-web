import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { echo } from '@inertiajs/react/echo';
import { configureEcho } from '@laravel/echo-react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { installClientIssueReporting } from './lib/clientIssues';
import { installViewportZoomGuard } from './lib/viewportZoom';

const CHUNK_RELOAD_KEY = 'ludo:chunk-reload-at';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();

    try {
        const lastReload = Number(
            window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? '0',
        );

        if (Date.now() - lastReload > CHUNK_RELOAD_COOLDOWN_MS) {
            window.sessionStorage.setItem(
                CHUNK_RELOAD_KEY,
                String(Date.now()),
            );
            window.location.reload();
        }
    } catch {
        window.location.reload();
    }
});

installClientIssueReporting();
installViewportZoomGuard();

const pageHost = window.location.hostname;
const configuredReverbHost = import.meta.env.VITE_REVERB_HOST as
    | string
    | undefined;
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const fellBackToPageHost =
    !configuredReverbHost ||
    (localHosts.has(configuredReverbHost) && !localHosts.has(pageHost));
const reverbHost = fellBackToPageHost ? pageHost : configuredReverbHost;
const reverbScheme =
    window.location.protocol === 'https:'
        ? 'https'
        : (import.meta.env.VITE_REVERB_SCHEME ?? 'http');
const rawReverbPort = import.meta.env.VITE_REVERB_PORT as string | undefined;
const parsedReverbPort = rawReverbPort ? Number(rawReverbPort) : NaN;
const reverbPort =
    fellBackToPageHost && reverbScheme === 'https'
        ? 443
        : Number.isFinite(parsedReverbPort) && parsedReverbPort > 0
          ? parsedReverbPort
          : reverbScheme === 'https'
            ? 443
            : 8080;

configureEcho({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    authEndpoint: route('broadcasting.room-auth'),
    auth: {
        headers: {
            'X-CSRF-Token':
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '',
        },
    },
    wsHost: reverbHost,
    wsPort: reverbPort,
    wssPort: reverbPort,
    forceTLS: reverbScheme === 'https',
    enabledTransports: ['ws', 'wss'],
});

const appName = 'Ludo Arena';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    live: echo(),
    resolve: async (name) =>
        (
            await resolvePageComponent(
                `./Pages/${name}.tsx`,
                import.meta.glob<{ default: ComponentType }>(
                    './Pages/**/*.tsx',
                ),
            )
        ).default,
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#2F6BEF',
    },
});
