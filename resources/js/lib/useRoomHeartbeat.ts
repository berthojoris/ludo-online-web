import { router, useHttp } from '@inertiajs/react';
import { useEffect } from 'react';

type HeartbeatResponse = {
    ok?: boolean;
    room_status?: string;
};

const HEARTBEAT_MS = 10_000;

/**
 * Keeps this browser's presence stamp fresh on the server while the room
 * tab is open, even in the background where the page polls are paused.
 *
 * The host's stamp is what the server watches: when it goes stale (closed
 * tab, crashed browser, dropped connection) the room is closed
 * automatically and every remaining player is sent back to the home page.
 * When this heartbeat hears the room already ended, this browser follows
 * along home too.
 */
export function useRoomHeartbeat(code: string | null, active: boolean) {
    const { post } = useHttp<Record<string, never>, HeartbeatResponse>({});

    useEffect(() => {
        if (!code || !active) {
            return;
        }

        const csrf =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        let inFlight = false;
        let stopped = false;

        const beat = async () => {
            if (inFlight) {
                return;
            }

            inFlight = true;

            try {
                const data = await post(
                    route('rooms.heartbeat', { code }),
                    { headers: { 'X-CSRF-TOKEN': csrf } },
                );

                if (!stopped && data?.room_status === 'ended') {
                    router.visit(route('home'), { replace: true });
                }
            } catch {
                // Offline or expired session: the next beat retries, and
                // the page poll plus realtime sync handle the recovery.
            } finally {
                inFlight = false;
            }
        };

        void beat();

        // Deliberately not paused on hidden tabs: browsers throttle
        // background timers to about one wake per minute, which the
        // server's stale threshold already tolerates.
        const interval = window.setInterval(() => {
            void beat();
        }, HEARTBEAT_MS);

        return () => {
            stopped = true;
            window.clearInterval(interval);
        };
    }, [code, active, post]);
}
