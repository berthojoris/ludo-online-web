import Dice from '@/Components/Game/Dice';
import Logo from '@/Components/Game/Logo';
import { ARENA_BACKGROUND_IMAGE } from '@/lib/ludo';
import { playUiSound, unlockAudio } from '@/lib/sound';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

const POOLS: readonly [2, 4] = [2, 4];
type Pool = 2 | 4;

type QueueResponse = {
    ok?: boolean;
    state?: 'idle' | 'waiting' | 'matched' | 'active';
    room?: string | null;
    waiting?: number;
    elapsed?: number;
};

const POLL_INTERVAL_MS = 4000;
const DUEL_BOT_OPTION_AFTER_SECONDS = 30;
const MAX_REJOIN_ATTEMPTS = 3;

function csrfToken(): string {
    return (
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? ''
    );
}

async function postQueue(
    url: string,
    body: Record<string, unknown>,
): Promise<QueueResponse> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
        },
        body: JSON.stringify(body),
    });

    if (response.status === 401 || response.status === 419) {
        window.location.reload();
        throw new Error('session-expired');
    }

    if (!response.ok) {
        throw new Error(`quick-match-${response.status}`);
    }

    return (await response.json()) as QueueResponse;
}

async function getQueueStatus(pool: Pool): Promise<QueueResponse> {
    const url = new URL(
        route('quick-match.status', { players: pool }),
        window.location.origin,
    );
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
        throw new Error(`quick-match-status-${response.status}`);
    }

    return (await response.json()) as QueueResponse;
}

function formatElapsed(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function QuickMatch() {
    const {
        pool: initialPool,
        state: initialState,
        name: initialName,
        token,
        waiting: initialWaiting,
        elapsed: initialElapsed,
    } = usePage().props as unknown as {
        pool: Pool;
        state: 'idle' | 'waiting';
        name: string;
        token: string;
        waiting: number;
        elapsed: number;
    };

    const [phase, setPhase] = useState<'ready' | 'searching'>(
        initialState === 'waiting' ? 'searching' : 'ready',
    );
    const [pool, setPool] = useState<Pool>(
        POOLS.includes(initialPool) ? initialPool : 4,
    );
    const [name, setName] = useState(initialName);
    const [waitingCount, setWaitingCount] = useState(initialWaiting);
    const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsed);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [busy, setBusy] = useState<'idle' | 'joining' | 'cancelling' | 'filling'>(
        'idle',
    );

    const busyRef = useRef(false);
    const navigatingRef = useRef(false);
    const rejoinAttemptsRef = useRef(0);
    const searchStartedAtRef = useRef(Date.now() - initialElapsed * 1000);
    const searchPoolRef = useRef(pool);
    const searchNameRef = useRef(name);

    searchPoolRef.current = pool;
    searchNameRef.current = name;

    const cue = useCallback((sound: () => void) => {
        void unlockAudio().then(sound);
    }, []);

    const goPlay = useCallback((code: string) => {
        if (navigatingRef.current || code === '') {
            return;
        }
        navigatingRef.current = true;
        router.visit(route('play', { room: code }), { replace: true });
    }, []);

    const startSearch = useCallback(
        async (nextPool: Pool, nextName: string) => {
            if (busyRef.current) {
                return;
            }
            busyRef.current = true;
            setBusy('joining');
            setJoinError(null);

            try {
                const data = await postQueue(route('quick-match.join'), {
                    players: nextPool,
                    name: nextName,
                });

                if (data.state === 'matched' || data.state === 'active') {
                    goPlay(data.room ?? '');
                    return;
                }

                setPool(nextPool);
                const elapsed = data.elapsed ?? 0;
                searchStartedAtRef.current = Date.now() - elapsed * 1000;
                setElapsedSeconds(elapsed);
                rejoinAttemptsRef.current = 0;
                setWaitingCount(data.waiting ?? 0);
                setPhase('searching');
            } catch {
                setJoinError('Gagal memulai pencarian. Coba lagi sebentar.');
            } finally {
                busyRef.current = false;
                setBusy('idle');
            }
        },
        [goPlay],
    );

    const cancelSearch = useCallback(async () => {
        if (busyRef.current || phase !== 'searching') {
            return;
        }
        busyRef.current = true;
        setBusy('cancelling');
        cue(playUiSound);

        try {
            await postQueue(route('quick-match.cancel'), {});
        } catch {
            // The waiting entry expires on its own once this page closes.
        }

        router.visit(route('home'), { replace: true });
    }, [phase, cue]);

    const fillWithComputers = useCallback(async () => {
        if (busyRef.current || phase !== 'searching') {
            return;
        }
        busyRef.current = true;
        setBusy('filling');
        cue(playUiSound);

        try {
            const data = await postQueue(route('quick-match.fill'), {
                players: searchPoolRef.current,
            });

            if (data.state === 'matched') {
                goPlay(data.room ?? '');
                return;
            }
        } catch {
            // The search itself keeps running; the next poll continues.
        } finally {
            busyRef.current = false;
            setBusy('idle');
        }
    }, [cue, goPlay]);

    const submitSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = name.trim().slice(0, 24);

        if (trimmed === '') {
            setJoinError('Nama tampilan tidak boleh kosong.');
            return;
        }

        cue(playUiSound);
        void startSearch(pool, trimmed);
    };

    useEffect(() => {
        if (phase !== 'searching') {
            return;
        }

        const interval = window.setInterval(() => {
            setElapsedSeconds(
                Math.max(0, Math.floor((Date.now() - searchStartedAtRef.current) / 1000)),
            );
        }, 1000);

        return () => {
            window.clearInterval(interval);
        };
    }, [phase]);

    // Polling heartbeat: it refreshes the waiting stamp on the server and
    // also gives this browser its pairing the moment the pool fills, even
    // when the realtime broadcast never arrives.
    useEffect(() => {
        if (phase !== 'searching') {
            return;
        }

        let stopped = false;
        let inFlight = false;

        const poll = async () => {
            if (stopped || inFlight) {
                return;
            }

            inFlight = true;

            try {
                const data = await getQueueStatus(searchPoolRef.current);

                if (stopped) {
                    return;
                }

                setWaitingCount(data.waiting ?? 0);

                if (data.state === 'matched' || data.state === 'active') {
                    goPlay(data.room ?? '');
                    return;
                }

                if (
                    data.state === 'idle' &&
                    rejoinAttemptsRef.current < MAX_REJOIN_ATTEMPTS
                ) {
                    rejoinAttemptsRef.current += 1;
                    void startSearch(searchPoolRef.current, searchNameRef.current);
                }
            } catch {
                // Offline or a blip: the next poll retries.
            } finally {
                inFlight = false;
            }
        };

        void poll();

        const interval = window.setInterval(() => {
            void poll();
        }, POLL_INTERVAL_MS);

        return () => {
            stopped = true;
            window.clearInterval(interval);
        };
    }, [phase, goPlay, startSearch]);

    // Instant jump when the pairing broadcast arrives.
    useEffect(() => {
        if (phase !== 'searching' || !token || !echoIsConfigured()) {
            return;
        }

        const channelName = `quick-match.${token}`;
        const channel = echo().private(channelName);

        channel.listen('.match.found', (payload: { room?: string }) => {
            if (payload?.room) {
                goPlay(payload.room);
            }
        });

        return () => {
            echo().leave(channelName);
        };
    }, [phase, token, goPlay]);

    return (
        <>
            <Head title="Main Cepat">
                <meta
                    name="description"
                    content="Cari lawan Ludo tanpa kode undangan: sistem menjodohkanmu dengan pemain lain yang sedang mencari dan langsung memulai pertandingan."
                />
            </Head>

            <div className="bg-canvas relative flex h-screen min-h-0 w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden"
                >
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-35"
                        style={{
                            backgroundImage: `url('${ARENA_BACKGROUND_IMAGE}')`,
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/75 to-white/90" />
                    <div className="bg-brand/10 absolute top-20 -left-32 h-80 w-80 rounded-full blur-3xl" />
                    <div className="bg-ludo-yellow/10 absolute top-44 -right-24 h-96 w-96 rounded-full blur-3xl" />
                </div>

                <header className="border-line/60 bg-canvas/80 z-40 shrink-0 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between px-[max(clamp(1rem,3vw,1.5rem),env(safe-area-inset-left),env(safe-area-inset-right))] sm:min-h-16">
                        <Link
                            href={route('home')}
                            aria-label="Kembali ke beranda Ludo Arena"
                            className="inline-flex min-h-11 items-center rounded-xl"
                        >
                            <Logo className="h-8 w-8 sm:h-9 sm:w-9" withWordmark />
                        </Link>
                        <Link
                            href={route('home')}
                            className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex min-h-11 items-center justify-center rounded-full border bg-white px-4 text-xs font-semibold shadow-sm transition active:scale-[0.985]"
                        >
                            Beranda
                        </Link>
                    </div>
                </header>

                <main className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain px-[max(clamp(1rem,3vw,1.5rem),env(safe-area-inset-left),env(safe-area-inset-right))] pb-[max(14px,env(safe-area-inset-bottom))] pt-[max(10px,1.6dvh)]">
                    <div className="m-auto w-full max-w-md py-6">
                        <div className="border-line shadow-card animate-fade-up rounded-3xl border bg-white/95 p-[clamp(1rem,3vw,1.5rem)] backdrop-blur-sm">
                            {phase === 'ready' ? (
                                <form onSubmit={submitSearch} noValidate>
                                    <div className="flex items-start gap-3">
                                        <span className="bg-brand/10 grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                                            <Dice value={6} className="h-6 w-6" />
                                        </span>
                                        <div className="min-w-0">
                                            <h1 className="text-ink text-base font-semibold">
                                                Main Cepat
                                            </h1>
                                            <p className="text-ink-muted mt-1 text-xs leading-relaxed">
                                                Tanpa kode undangan: sistem
                                                menjodohkanmu dengan pemain lain
                                                yang juga sedang mencari, lalu
                                                pertandingan langsung dimulai.
                                            </p>
                                        </div>
                                    </div>

                                    <fieldset
                                        disabled={busy !== 'idle'}
                                        className="mt-4"
                                    >
                                        <label
                                            htmlFor="quick-match-name"
                                            className="text-ink block text-xs font-semibold"
                                        >
                                            Nama tampilan
                                        </label>
                                        <input
                                            id="quick-match-name"
                                            name="name"
                                            type="text"
                                            value={name}
                                            onChange={(event) =>
                                                setName(event.target.value)
                                            }
                                            maxLength={24}
                                            autoComplete="off"
                                            placeholder="Nama yang terlihat lawanmu"
                                            className={`text-ink placeholder:text-ink-muted/70 h-11 w-full rounded-xl border bg-white px-3 text-base transition outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-60 ${
                                                joinError
                                                    ? 'border-danger'
                                                    : 'border-line'
                                            }`}
                                            aria-invalid={
                                                joinError ? 'true' : undefined
                                            }
                                            aria-describedby={
                                                joinError
                                                    ? 'quick-match-error'
                                                    : undefined
                                            }
                                        />

                                        <fieldset className="mt-4">
                                            <legend className="text-ink text-xs font-semibold">
                                                Mode pemain
                                            </legend>
                                            <div
                                                className="segmented mt-1.5 grid grid-cols-2"
                                                role="group"
                                            >
                                                {POOLS.map((option) => (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        className="segmented-item min-h-11 px-2 text-xs"
                                                        aria-pressed={
                                                            pool === option
                                                        }
                                                        onClick={() => {
                                                            setPool(option);
                                                            cue(playUiSound);
                                                        }}
                                                    >
                                                        {option} Pemain
                                                    </button>
                                                ))}
                                            </div>
                                        </fieldset>

                                        <p className="text-ink-muted mt-3 text-xs leading-relaxed">
                                            Dadu murni acak: mode Quick Match
                                            mematikan keuntungan host, semua
                                            pemain bermain dengan peluang yang
                                            sama.
                                        </p>

                                        {joinError ? (
                                            <p
                                                id="quick-match-error"
                                                role="alert"
                                                className="text-danger mt-3 text-xs leading-relaxed"
                                            >
                                                {joinError}
                                            </p>
                                        ) : null}
                                    </fieldset>

                                    <button
                                        type="submit"
                                        aria-busy={busy === 'joining'}
                                        disabled={busy !== 'idle'}
                                        className="btn btn-primary mt-5 w-full"
                                    >
                                        {busy === 'joining'
                                            ? 'Memulai pencarian…'
                                            : 'Cari Lawan'}
                                    </button>
                                </form>
                            ) : (
                                <div aria-live="polite">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span
                                                aria-hidden="true"
                                                className="bg-brand/10 grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
                                            >
                                                <span className="flex items-end gap-1">
                                                    {[0, 1, 2].map((dot) => (
                                                        <span
                                                            key={dot}
                                                            className="bg-brand h-1.5 w-1.5 animate-bounce rounded-full"
                                                            style={{
                                                                animationDelay: `${dot * 140}ms`,
                                                            }}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                            <div className="min-w-0">
                                                <h1 className="text-ink text-base font-semibold">
                                                    Mencari pemain…
                                                </h1>
                                                <p className="text-ink-muted mt-1 text-xs leading-relaxed">
                                                    Mode {pool} pemain · dadu
                                                    murni acak tanpa keuntungan
                                                    host.
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className="text-ink shrink-0 font-mono text-sm tabular-nums"
                                            aria-label={`Waktu mencari ${formatElapsed(elapsedSeconds)}`}
                                        >
                                            {formatElapsed(elapsedSeconds)}
                                        </span>
                                    </div>

                                    <div
                                        aria-hidden="true"
                                        className="bg-surface-muted mt-4 h-1 w-full overflow-hidden rounded-full"
                                    >
                                        <div
                                            className="bg-brand h-full w-1/3 animate-pulse rounded-full"
                                            style={{
                                                animationDuration: '1.6s',
                                            }}
                                        />
                                    </div>

                                    <p className="text-ink-muted mt-3 flex items-center gap-1.5 text-xs">
                                        <span
                                            aria-hidden="true"
                                            className="relative flex h-2 w-2"
                                        >
                                            <span className="bg-ludo-green absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                                            <span className="bg-ludo-green relative inline-flex h-2 w-2 rounded-full" />
                                        </span>
                                        {waitingCount > 0
                                            ? `${waitingCount} pemain sedang mencari di mode ini`
                                            : 'Menunggu pemain lain bergabung'}
                                    </p>

                                    {pool === 4 ? (
                                        <p className="text-ink-muted mt-4 text-xs leading-relaxed">
                                            Jika kursi belum lengkap setelah 2 menit,
                                            komputer mengisi kursi kosong dan
                                            pertandingan langsung dimulai.
                                        </p>
                                    ) : elapsedSeconds >= DUEL_BOT_OPTION_AFTER_SECONDS ? (
                                        <div className="border-line bg-canvas mt-4 rounded-2xl border p-3">
                                            <p className="text-ink-muted text-xs leading-relaxed">
                                                Sudah lebih dari 30 detik dan
                                                kursi belum lengkap. Isi sisa
                                                kursi dengan komputer dan
                                                langsung main sekarang.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void fillWithComputers()
                                                }
                                                aria-busy={busy === 'filling'}
                                                disabled={busy !== 'idle'}
                                                className="btn btn-primary mt-3 w-full"
                                            >
                                                {busy === 'filling'
                                                    ? 'Menyiapkan komputer…'
                                                    : 'Main dengan Komputer'}
                                            </button>
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => void cancelSearch()}
                                        aria-busy={busy === 'cancelling'}
                                        disabled={busy !== 'idle'}
                                        className="btn btn-secondary mt-5 w-full"
                                    >
                                        {busy === 'cancelling'
                                            ? 'Membatalkan…'
                                            : 'Batalkan pencarian'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
