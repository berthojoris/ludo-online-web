import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { installClientIssueReporting } from './lib/clientIssues';

installClientIssueReporting();

const pageHost = window.location.hostname;
const configuredReverbHost = import.meta.env.VITE_REVERB_HOST as
    string | undefined;
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const reverbHost =
    !configuredReverbHost ||
    (localHosts.has(configuredReverbHost) && !localHosts.has(pageHost))
        ? pageHost
        : configuredReverbHost;
const reverbPort = Number(import.meta.env.VITE_REVERB_PORT ?? 8080);
const reverbScheme =
    window.location.protocol === 'https:'
        ? 'https'
        : (import.meta.env.VITE_REVERB_SCHEME ?? 'http');

configureEcho({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: reverbHost,
    wsPort: reverbPort,
    wssPort: reverbPort,
    forceTLS: reverbScheme === 'https',
    enabledTransports: ['ws', 'wss'],
});

const appName = 'Ludo Arena';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
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
