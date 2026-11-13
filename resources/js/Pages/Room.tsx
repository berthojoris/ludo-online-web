import {
    ArrowRightIcon,
    CheckIcon,
    ChevronLeftIcon,
    CloseIcon,
    CopyIcon,
    DiceIcon,
    HashIcon,
    InfoIcon,
    LinkIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import { PLAYER_CONFIG, PlayerColor } from '@/lib/ludo';
import { playUiSound, unlockAudio } from '@/lib/sound';
import { User } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { CSSProperties, FormEvent, useEffect, useState } from 'react';

type CopyState = 'idle' | 'code' | 'link' | 'error';
type ViewMode = 'lobby' | 'join';
type PlayerCount = 2 | 3 | 4;

type RoomPlayerData = {
    id: number;
    name: string;
    seat_color: PlayerColor | null;
    is_ready: boolean;
    is_host: boolean;
};

type RoomData = {
    code: string;
    host_advantage: boolean;
    max_players: PlayerCount;
    status: 'waiting' | 'started';
    players: RoomPlayerData[];
};

type RoomPageProps = {
    auth?: { user: User | null };
    mode?: 'create' | 'lobby' | 'join';
    room?: RoomData | null;
    me?: RoomPlayerData | null;
    roomError?: string | null;
};

const SEATS_BY_COUNT: Record<PlayerCount, PlayerColor[]> = {
    2: ['red', 'yellow'],
    3: ['red', 'green', 'yellow'],
    4: ['red', 'green', 'blue', 'yellow'],
};

const SEAT_GRID_CLASS: Record<PlayerCount, string> = {
    2: 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1',
    3: 'grid-cols-1 grid-rows-3 sm:grid-cols-3 sm:grid-rows-1',
    4: 'grid-cols-2 grid-rows-2',
};

const ROOM_RULES = [
    { label: 'Timer giliran', value: '15 detik' },
    { label: 'Keluar markas', value: 'Angka 6' },
    { label: 'Tiga kali angka 6', value: 'Hangus' },
    { label: 'Petak aman', value: '8 petak' },
];

function RoomSettingsSummary({
    playerCount,
    hostAdvantage,
    isHost,
    pending,
    onSelectPlayerCount,
    onToggleAdvantage,
}: {
    playerCount: PlayerCount;
    hostAdvantage: boolean;
    isHost: boolean;
    pending: boolean;
    onSelectPlayerCount: (count: PlayerCount) => void;
    onToggleAdvantage: () => void;
}) {
    return (
        <>
            <div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-muted block text-xs font-medium">
                        Kapasitas pemain
                    </span>
                    {!isHost && (
                        <span className="text-ink-muted text-[10px] font-medium">
                            Diatur tuan rumah
                        </span>
                    )}
                </div>
                <div className="border-line bg-canvas mt-1.5 grid grid-cols-3 gap-1 rounded-xl border p-1">
                    {([2, 3, 4] as PlayerCount[]).map((count) => (
                        <button
                            key={count}
                            type="button"
                            disabled={!isHost || pending}
                            onClick={() => onSelectPlayerCount(count)}
                            aria-pressed={playerCount === count}
                            className={`h-8 rounded-lg text-xs font-semibold transition disabled:cursor-not-allowed ${
                                playerCount === count
                                    ? 'text-ink bg-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink disabled:opacity-50'
                            }`}
                        >
                            {count} Pemain
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-line mt-4 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5">
                <div className="min-w-0">
                    <p className="text-ink text-xs font-semibold">
                        Keuntungan tuan rumah
                    </p>
                    <p className="text-ink-muted mt-1 text-xs">
                        Peluang 50% untuk keluar markas atau menangkap saat
                        tersedia.
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-label="Keuntungan tuan rumah"
                    aria-checked={hostAdvantage}
                    aria-busy={pending}
                    disabled={!isHost || pending}
                    onClick={onToggleAdvantage}
                    className={`focus-visible:ring-primary flex h-11 min-w-14 items-center justify-center rounded-full text-xs font-semibold focus-visible:ring-2 disabled:opacity-60 ${hostAdvantage ? 'bg-blue-600 text-white' : 'bg-surface-muted text-ink-muted'}`}
                >
                    {pending ? '…' : hostAdvantage ? 'ON' : 'OFF'}
                </button>
            </div>
            <dl className="divide-line border-line mt-4 divide-y rounded-2xl border px-3.5">
                {ROOM_RULES.map((item) => (
                    <div
                        key={item.label}
                        className="flex items-center justify-between py-2.5 text-xs"
                    >
                        <dt className="text-ink-muted">{item.label}</dt>
                        <dd className="text-ink font-semibold tabular-nums">
                            {item.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </>
    );
}

function normalizeCode(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
}

async function copyText(value: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);

            return true;
        }

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);

        return copied;
    } catch {
        return false;
    }
}

export default function Room() {
    const page = usePage();
    const {
        mode: initialMode,
        room: serverRoom,
        me: serverMe,
        roomError,
    } = page.props as unknown as RoomPageProps;

    const [liveRoom, setLiveRoom] = useState<RoomData | null>(
        serverRoom ?? null,
    );
    const [viewMode, setViewMode] = useState<ViewMode>(
        initialMode === 'join' || !serverRoom ? 'join' : 'lobby',
    );
    const [joinCode, setJoinCode] = useState(serverRoom?.code ?? '');
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const [rulesModalOpen, setRulesModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState(false);
    const [actionError, setActionError] = useState<string | null>(
        roomError ?? null,
    );
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(serverMe?.name ?? '');

    useEffect(() => {
        setLiveRoom(serverRoom ?? null);
        setViewMode(initialMode === 'join' || !serverRoom ? 'join' : 'lobby');
        if (serverRoom?.code) {
            setJoinCode(serverRoom.code);
        }
        if (serverMe?.name) {
            setNameDraft(serverMe.name);
        }
    }, [initialMode, serverRoom, serverMe]);

    useEffect(() => {
        setActionError(roomError ?? null);
    }, [roomError]);

    useEffect(() => {
        const previous = document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    useEffect(() => {
        if (!rulesModalOpen) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setRulesModalOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [rulesModalOpen]);

    const roomCode = liveRoom?.code ?? null;
    const roomStatus = liveRoom?.status ?? 'waiting';

    // Real-time Reverb subscription for room state updates
    useEffect(() => {
        if (!roomCode || !echoIsConfigured()) {
            return;
        }

        const channelName = `room.${roomCode}`;
        const channel = echo().channel(channelName);

        channel.listen('.room.updated', (payload: { room?: RoomData }) => {
            if (payload?.room) {
                setLiveRoom(payload.room);
            }
        });

        return () => {
            echo().leave(channelName);
        };
    }, [roomCode]);

    // Lightweight fallback sync while waiting in lobby
    useEffect(() => {
        if (!roomCode || roomStatus !== 'waiting' || viewMode !== 'lobby') {
            return;
        }

        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                router.reload({
                    only: ['room', 'me'],
                });
            }
        }, 4000);

        return () => window.clearInterval(interval);
    }, [roomCode, roomStatus, viewMode]);

    // Auto-redirect all players when host starts the match
    useEffect(() => {
        if (liveRoom?.status === 'started' && liveRoom.code) {
            router.visit(route('play', { room: liveRoom.code }));
        }
    }, [liveRoom?.status, liveRoom?.code]);

    const cue = () => {
        void unlockAudio().then(playUiSound);
    };

    const currentMe: RoomPlayerData | null =
        liveRoom?.players.find((p) => p.id === serverMe?.id) ??
        serverMe ??
        null;
    const isHost = Boolean(currentMe?.is_host);
    const playerCount: PlayerCount = liveRoom?.max_players ?? 4;
    const activeSeats = SEATS_BY_COUNT[playerCount];
    const players = liveRoom?.players ?? [];
    const occupiedCount = players.length;
    const readyCount = players.filter((p) => p.is_ready).length;
    const allSeated =
        players.length > 0 && players.every((p) => p.seat_color !== null);
    const allReady =
        players.length === 2 && allSeated && players.every((p) => p.is_ready);

    const startBlockedReason =
        players.length < 2
            ? 'Menunggu minimal 2 pemain bergabung ke ruang.'
            : players.length > 2
              ? 'Pertandingan saat ini mendukung dua pemain.'
              : !allSeated
                ? 'Semua pemain harus memilih kursi terlebih dahulu.'
                : !allReady
                  ? `Menunggu semua pemain siap (${readyCount}/${players.length} siap).`
                  : null;

    const shareLink =
        typeof window !== 'undefined' && liveRoom
            ? `${window.location.origin}/room?code=${liveRoom.code}`
            : liveRoom
              ? `/room?code=${liveRoom.code}`
              : '';

    const copy = async (value: string, target: 'code' | 'link') => {
        if (!value) {
            return;
        }
        cue();
        const copied = await copyText(value);
        setCopyState(copied ? target : 'error');
        window.setTimeout(() => setCopyState('idle'), 1800);
    };

    const handleFirstError = (errors: Record<string, string>) => {
        const first = Object.values(errors)[0];
        if (first) {
            setActionError(first);
        }
    };

    const handleSelectPlayerCount = (count: PlayerCount) => {
        if (!liveRoom || !isHost || count === playerCount) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.patch(
            route('rooms.settings', { code: liveRoom.code }),
            { max_players: count },
            {
                preserveScroll: true,
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleToggleAdvantage = () => {
        if (!liveRoom || !isHost || pendingAction) return;
        const next = !liveRoom.host_advantage;
        cue();
        setActionError(null);
        setPendingAction(true);
        router
            .optimistic((props: RoomPageProps) => ({
                room: { ...(props.room as RoomData), host_advantage: next },
            }))
            .patch(
                route('rooms.settings', { code: liveRoom.code }),
                { host_advantage: next },
                {
                    preserveScroll: true,
                    onError: handleFirstError,
                    onFinish: () => setPendingAction(false),
                },
            );
    };

    const handleSelectSeat = (color: PlayerColor | null) => {
        if (!liveRoom || pendingAction) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.seat', { code: liveRoom.code }),
            { seat_color: color },
            {
                preserveScroll: true,
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleToggleReady = () => {
        if (!liveRoom || pendingAction) {
            return;
        }
        if (!currentMe?.seat_color) {
            setActionError(
                'Pilih kursi terlebih dahulu sebelum menandai siap.',
            );
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.ready', { code: liveRoom.code }),
            { is_ready: !currentMe.is_ready },
            {
                preserveScroll: true,
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleStartMatch = () => {
        if (!liveRoom || !isHost || !allReady || pendingAction) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.start', { code: liveRoom.code }),
            {},
            {
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleSaveName = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!liveRoom || !nameDraft.trim() || pendingAction) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.name', { code: liveRoom.code }),
            { name: nameDraft.trim() },
            {
                preserveScroll: true,
                onSuccess: () => setEditingName(false),
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleCreateNewRoom = () => {
        if (pendingAction) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.store'),
            { max_players: playerCount },
            {
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleJoin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (joinCode.length !== 6) {
            return;
        }

        cue();
        setActionError(null);
        router.get(route('room'), { code: joinCode });
    };

    const switchMode = (next: ViewMode) => {
        cue();
        if (next === 'lobby' && !liveRoom) {
            router.get(route('room'));
            return;
        }
        setViewMode(next);
    };

    return (
        <>
            <Head title="Ruang privat" />

            <div className="bg-canvas flex h-screen min-h-0 w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]">
                <header className="border-line shrink-0 border-b bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
                    <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-2 px-3 sm:h-14 sm:px-6">
                        <div className="flex min-w-0 items-center gap-2">
                            <Link
                                href={route('home')}
                                aria-label="Kembali ke beranda"
                                className="border-line text-ink-muted hover:bg-surface-muted hover:text-ink grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-white transition"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Link>
                            <Link href={route('home')} className="rounded-lg">
                                <Logo
                                    className="h-7 w-7"
                                    withWordmark
                                    compact
                                />
                            </Link>
                        </div>

                        <div
                            className="border-line bg-canvas inline-flex items-center rounded-full border p-0.5"
                            role="tablist"
                            aria-label="Mode ruang"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={viewMode === 'lobby'}
                                onClick={() => switchMode('lobby')}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                    viewMode === 'lobby'
                                        ? 'text-ink bg-white shadow-sm'
                                        : 'text-ink-muted hover:text-ink'
                                }`}
                            >
                                Meja
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={viewMode === 'join'}
                                onClick={() => switchMode('join')}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                    viewMode === 'join'
                                        ? 'text-ink bg-white shadow-sm'
                                        : 'text-ink-muted hover:text-ink'
                                }`}
                            >
                                Gabung
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {viewMode === 'lobby' && liveRoom && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        cue();
                                        setRulesModalOpen(true);
                                    }}
                                    aria-label="Lihat aturan main"
                                    className="border-line text-ink-muted hover:bg-surface-muted hover:text-ink inline-flex h-8 items-center gap-1.5 rounded-full border bg-white px-2.5 text-xs font-semibold transition md:hidden"
                                >
                                    <InfoIcon className="h-3.5 w-3.5" />
                                    <span className="hidden min-[380px]:inline">
                                        Aturan
                                    </span>
                                </button>
                            )}
                            <span className="border-line text-ink-muted hidden items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-semibold sm:inline-flex">
                                <span
                                    className={`h-2 w-2 rounded-full ${
                                        allReady
                                            ? 'bg-ludo-green'
                                            : 'bg-warning'
                                    }`}
                                />
                                {allReady
                                    ? 'Semua siap'
                                    : `${readyCount}/${occupiedCount} Siap`}
                            </span>
                        </div>
                    </div>
                </header>

                {viewMode === 'join' || !liveRoom ? (
                    <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
                        <div className="animate-modal-enter border-line shadow-card w-full max-w-md rounded-[24px] border bg-white p-5 sm:p-7">
                            <div className="flex items-center gap-3">
                                <span className="bg-brand/10 text-brand-ink grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                                    <HashIcon className="h-5.5 w-5.5" />
                                </span>
                                <div>
                                    <h1 className="text-ink text-lg font-semibold tracking-tight sm:text-xl">
                                        Gabung ruang privat
                                    </h1>
                                    <p className="text-ink-muted text-xs sm:text-sm">
                                        Masukkan 6 karakter kode undangan.
                                    </p>
                                </div>
                            </div>

                            {actionError && (
                                <p
                                    role="alert"
                                    className="bg-danger/10 text-danger mt-4 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                                >
                                    {actionError}
                                </p>
                            )}

                            <form onSubmit={handleJoin} className="mt-5">
                                <label
                                    htmlFor="room-code"
                                    className="text-ink block text-xs font-semibold"
                                >
                                    Kode ruang
                                </label>
                                <input
                                    id="room-code"
                                    value={joinCode}
                                    onChange={(event) =>
                                        setJoinCode(
                                            normalizeCode(event.target.value),
                                        )
                                    }
                                    inputMode="text"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    spellCheck={false}
                                    maxLength={6}
                                    placeholder="ABC123"
                                    aria-label="Kode ruang enam karakter"
                                    className="border-line bg-canvas text-ink placeholder:text-ink-muted/35 focus:border-brand focus:ring-brand/10 mt-2 h-15 w-full rounded-2xl border px-4 text-center font-mono text-2xl font-semibold tracking-[0.34em] uppercase transition focus:bg-white focus:ring-4 focus:outline-none sm:h-16 sm:text-3xl"
                                />

                                <div
                                    className="mt-3 grid grid-cols-6 gap-1.5"
                                    aria-hidden="true"
                                >
                                    {[0, 1, 2, 3, 4, 5].map((index) => (
                                        <span
                                            key={index}
                                            className={`h-1 rounded-full transition-colors ${
                                                index < joinCode.length
                                                    ? 'bg-brand'
                                                    : 'bg-line'
                                            }`}
                                        />
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    disabled={joinCode.length !== 6}
                                    className="bg-brand hover:bg-brand-dark disabled:bg-surface-muted disabled:text-ink-muted mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.75)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    Masuk ke ruang
                                    <ArrowRightIcon className="h-4 w-4" />
                                </button>
                            </form>

                            <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-xs">
                                <span className="text-ink-muted">
                                    Belum punya kode?
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCreateNewRoom}
                                    className="text-brand-ink font-semibold hover:underline"
                                >
                                    Buat ruang baru
                                </button>
                            </div>
                        </div>
                    </main>
                ) : (
                    <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4 sm:pb-4">
                        <div className="grid min-h-0 flex-1 gap-2.5 sm:gap-4 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_328px]">
                            <section className="flex min-h-0 flex-col gap-2 sm:gap-3">
                                <div className="border-line shadow-card flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white px-3.5 py-2.5 sm:px-4 sm:py-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div>
                                            <p className="text-ink-muted text-[11px] leading-none font-medium">
                                                Kode ruang
                                            </p>
                                            <p className="text-ink mt-1 font-mono text-lg font-semibold tracking-[0.22em] sm:text-2xl">
                                                {liveRoom.code}
                                            </p>
                                        </div>
                                        <span className="border-line bg-canvas text-ink-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums">
                                            <UsersIcon className="h-3.5 w-3.5" />
                                            {occupiedCount}/{playerCount}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copy(liveRoom.code, 'code')
                                            }
                                            className="border-line text-ink hover:bg-surface-muted inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold transition"
                                        >
                                            {copyState === 'code' ? (
                                                <>
                                                    <CheckIcon className="text-success-ink h-3.5 w-3.5" />
                                                    <span>Tersalin</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CopyIcon className="h-3.5 w-3.5" />
                                                    <span>Salin</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copy(shareLink, 'link')
                                            }
                                            className="border-line text-ink hover:bg-surface-muted inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold transition"
                                        >
                                            {copyState === 'link' ? (
                                                <>
                                                    <CheckIcon className="text-success-ink h-3.5 w-3.5" />
                                                    <span>Tautan tersalin</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LinkIcon className="h-3.5 w-3.5" />
                                                    <span className="hidden min-[400px]:inline">
                                                        Tautan
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Joined players & display name bar */}
                                <div className="border-line flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white/85 px-3 py-2 sm:px-4">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                        <span className="text-ink-muted mr-1 text-[11px] font-medium">
                                            Di ruang:
                                        </span>
                                        {players.map((player) => {
                                            const seatCfg = player.seat_color
                                                ? PLAYER_CONFIG[
                                                      player.seat_color
                                                  ]
                                                : null;

                                            return (
                                                <span
                                                    key={player.id}
                                                    className="border-line bg-canvas inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                                                >
                                                    <span
                                                        className="h-2 w-2 rounded-full"
                                                        style={{
                                                            backgroundColor:
                                                                seatCfg
                                                                    ? seatCfg
                                                                          .palette
                                                                          .base
                                                                    : '#94A3B8',
                                                        }}
                                                    />
                                                    <span className="text-ink max-w-[96px] truncate">
                                                        {player.name}
                                                    </span>
                                                    {player.id ===
                                                        currentMe?.id && (
                                                        <span className="text-ink-muted">
                                                            (Kamu)
                                                        </span>
                                                    )}
                                                    <span
                                                        className={
                                                            player.is_ready
                                                                ? 'text-success-ink'
                                                                : 'text-ink-muted'
                                                        }
                                                    >
                                                        {player.is_ready
                                                            ? '· Siap'
                                                            : player.seat_color
                                                              ? ''
                                                              : '· Pilih kursi'}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {currentMe &&
                                        (editingName ? (
                                            <form
                                                onSubmit={handleSaveName}
                                                className="flex items-center gap-1"
                                            >
                                                <input
                                                    type="text"
                                                    value={nameDraft}
                                                    onChange={(e) =>
                                                        setNameDraft(
                                                            e.target.value.slice(
                                                                0,
                                                                24,
                                                            ),
                                                        )
                                                    }
                                                    maxLength={24}
                                                    aria-label="Nama tampilan"
                                                    className="border-line bg-canvas text-ink h-7 w-28 rounded-lg border px-2 text-xs font-medium focus:outline-none"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={
                                                        !nameDraft.trim() ||
                                                        pendingAction
                                                    }
                                                    className="bg-brand h-7 rounded-lg px-2 text-[11px] font-semibold text-white"
                                                >
                                                    Simpan
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingName(false);
                                                        setNameDraft(
                                                            currentMe.name,
                                                        );
                                                    }}
                                                    className="text-ink-muted h-7 px-1.5 text-[11px] font-medium"
                                                >
                                                    Batal
                                                </button>
                                            </form>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNameDraft(
                                                        currentMe.name,
                                                    );
                                                    setEditingName(true);
                                                }}
                                                className="text-brand-ink text-[11px] font-semibold hover:underline"
                                            >
                                                Ubah nama
                                            </button>
                                        ))}
                                </div>

                                {actionError && (
                                    <p
                                        role="alert"
                                        className="bg-danger/10 text-danger shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold"
                                    >
                                        {actionError}
                                    </p>
                                )}

                                <div
                                    className={`relative grid min-h-0 flex-1 gap-2.5 sm:gap-3.5 ${SEAT_GRID_CLASS[playerCount]}`}
                                    role="group"
                                    aria-label="Kursi meja Ludo"
                                >
                                    {playerCount === 4 && (
                                        <div
                                            aria-hidden="true"
                                            className="border-line pointer-events-none absolute top-1/2 left-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border bg-white shadow-sm sm:grid"
                                        >
                                            <div className="relative h-7 w-7 overflow-hidden rounded-md">
                                                <div
                                                    className="bg-ludo-red absolute inset-0"
                                                    style={{
                                                        clipPath:
                                                            'polygon(0 0, 50% 50%, 0 100%)',
                                                    }}
                                                />
                                                <div
                                                    className="bg-ludo-green absolute inset-0"
                                                    style={{
                                                        clipPath:
                                                            'polygon(0 0, 100% 0, 50% 50%)',
                                                    }}
                                                />
                                                <div
                                                    className="bg-ludo-yellow absolute inset-0"
                                                    style={{
                                                        clipPath:
                                                            'polygon(100% 0, 100% 100%, 50% 50%)',
                                                    }}
                                                />
                                                <div
                                                    className="bg-ludo-blue absolute inset-0"
                                                    style={{
                                                        clipPath:
                                                            'polygon(0 100%, 100% 100%, 50% 50%)',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {activeSeats.map((color) => {
                                        const config = PLAYER_CONFIG[color];
                                        const palette = config.palette;
                                        const occupant = players.find(
                                            (p) => p.seat_color === color,
                                        );
                                        const isYou =
                                            occupant !== undefined &&
                                            occupant.id === currentMe?.id;
                                        const occupied = Boolean(occupant);

                                        const tokenStyle = {
                                            '--token-light': palette.light,
                                            '--token-base': palette.base,
                                            '--token-dark': palette.dark,
                                        } as CSSProperties;

                                        return (
                                            <div
                                                key={color}
                                                className={`relative flex min-h-0 flex-col justify-between overflow-hidden rounded-[20px] border p-3 transition sm:rounded-[22px] sm:p-4 ${
                                                    occupied
                                                        ? 'border-line shadow-card bg-white'
                                                        : 'border-line/90 bg-white/70 hover:bg-white'
                                                }`}
                                                style={
                                                    isYou
                                                        ? {
                                                              borderColor: `${palette.base}55`,
                                                              background: `linear-gradient(180deg, ${palette.soft}52 0%, #ffffff 56%)`,
                                                          }
                                                        : undefined
                                                }
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span
                                                            className="ludo-token h-6 w-6 shrink-0 rounded-full border-2 border-white sm:h-7 sm:w-7"
                                                            style={tokenStyle}
                                                            aria-hidden="true"
                                                        />
                                                        <span
                                                            className="truncate text-xs font-semibold sm:text-sm"
                                                            style={{
                                                                color: palette.text,
                                                            }}
                                                        >
                                                            {config.label}
                                                        </span>
                                                    </div>

                                                    {occupant ? (
                                                        <span
                                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                                occupant.is_ready
                                                                    ? 'bg-success/10 text-success-ink'
                                                                    : 'bg-warning/10 text-warning-ink'
                                                            }`}
                                                        >
                                                            {occupant.is_ready
                                                                ? 'Siap'
                                                                : 'Belum siap'}
                                                        </span>
                                                    ) : (
                                                        <span className="bg-surface-muted text-ink-muted shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                                            Kosong
                                                        </span>
                                                    )}
                                                </div>

                                                <div
                                                    className="room-seat-scene"
                                                    style={tokenStyle}
                                                    aria-hidden="true"
                                                >
                                                    <div className="room-seat-orbit room-seat-orbit-outer" />
                                                    <div className="room-seat-orbit room-seat-orbit-inner" />
                                                    <div
                                                        className={`room-seat-piece ${occupied ? 'room-seat-piece-occupied' : 'room-seat-piece-waiting'}`}
                                                    >
                                                        <span className="ludo-token room-seat-token" />
                                                        <span className="room-seat-piece-base" />
                                                    </div>
                                                    <div className="room-seat-marker room-seat-marker-one" />
                                                    <div className="room-seat-marker room-seat-marker-two" />
                                                </div>

                                                {occupant ? (
                                                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                                                        <div className="flex min-w-0 items-center gap-2.5">
                                                            <span
                                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold sm:h-10 sm:w-10 sm:text-sm"
                                                                style={{
                                                                    background:
                                                                        palette.soft,
                                                                    color: palette.text,
                                                                }}
                                                            >
                                                                {occupant.name
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="text-ink truncate text-sm font-semibold sm:text-base">
                                                                    {
                                                                        occupant.name
                                                                    }
                                                                </p>
                                                                <p className="text-ink-muted text-[11px] leading-tight">
                                                                    {isYou
                                                                        ? occupant.is_host
                                                                            ? 'Kamu · Tuan rumah'
                                                                            : 'Kamu · Tamu'
                                                                        : occupant.is_host
                                                                          ? 'Tuan rumah'
                                                                          : 'Pemain'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {isYou && (
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    pendingAction
                                                                }
                                                                onClick={() =>
                                                                    handleSelectSeat(
                                                                        null,
                                                                    )
                                                                }
                                                                className="border-line text-ink-muted hover:bg-surface-muted hover:text-ink shrink-0 rounded-xl border bg-white px-2.5 py-1 text-[11px] font-semibold transition"
                                                            >
                                                                Berdiri
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                pendingAction
                                                            }
                                                            onClick={() =>
                                                                handleSelectSeat(
                                                                    color,
                                                                )
                                                            }
                                                            className="border-line text-ink hover:bg-surface-muted inline-flex h-8 items-center rounded-xl border bg-white px-2.5 text-xs font-semibold transition sm:h-9 sm:px-3"
                                                        >
                                                            Duduk di sini
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                copy(
                                                                    shareLink,
                                                                    'link',
                                                                )
                                                            }
                                                            aria-label={`Undang ke kursi ${config.label}`}
                                                            className="text-brand-ink hover:bg-brand/10 inline-flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-semibold transition sm:h-9 sm:px-2.5"
                                                        >
                                                            <LinkIcon className="h-3.5 w-3.5" />
                                                            <span className="hidden sm:inline">
                                                                Undang
                                                            </span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <aside className="hidden min-h-0 flex-col md:flex">
                                <section className="border-line shadow-card flex min-h-0 flex-1 flex-col rounded-[22px] border bg-white p-4">
                                    <div className="mb-4 flex items-center justify-between gap-2">
                                        <h1 className="text-ink text-base font-semibold tracking-tight">
                                            Pengaturan meja
                                        </h1>
                                        {isHost ? (
                                            <button
                                                type="button"
                                                disabled={pendingAction}
                                                onClick={handleCreateNewRoom}
                                                className="bg-surface-muted text-ink-muted hover:text-ink rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition"
                                            >
                                                Ruang baru
                                            </button>
                                        ) : (
                                            <span className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                                Tamu
                                            </span>
                                        )}
                                    </div>

                                    <RoomSettingsSummary
                                        playerCount={playerCount}
                                        hostAdvantage={Boolean(
                                            liveRoom?.host_advantage,
                                        )}
                                        onToggleAdvantage={
                                            handleToggleAdvantage
                                        }
                                        isHost={isHost}
                                        pending={pendingAction}
                                        onSelectPlayerCount={
                                            handleSelectPlayerCount
                                        }
                                    />

                                    <div className="border-line/80 mt-auto flex flex-col gap-2 border-t pt-4">
                                        <button
                                            type="button"
                                            disabled={
                                                !currentMe?.seat_color ||
                                                pendingAction
                                            }
                                            onClick={handleToggleReady}
                                            aria-pressed={Boolean(
                                                currentMe?.is_ready,
                                            )}
                                            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
                                                currentMe?.is_ready
                                                    ? 'border-success/25 bg-success/10 text-success-ink border'
                                                    : 'border-line text-ink hover:bg-surface-muted border bg-white'
                                            }`}
                                        >
                                            {!currentMe?.seat_color ? (
                                                'Pilih kursi dulu'
                                            ) : currentMe.is_ready ? (
                                                <>
                                                    <CheckIcon className="h-4 w-4" />
                                                    Siap bermain
                                                </>
                                            ) : (
                                                'Tandai siap'
                                            )}
                                        </button>

                                        {isHost ? (
                                            <button
                                                type="button"
                                                disabled={
                                                    !allReady || pendingAction
                                                }
                                                onClick={handleStartMatch}
                                                className="bg-brand hover:bg-brand-dark disabled:bg-surface-muted disabled:text-ink-muted inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,107,239,0.8)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:shadow-none"
                                            >
                                                <DiceIcon className="h-4 w-4" />
                                                Mulai main
                                            </button>
                                        ) : (
                                            <div className="bg-surface-muted text-ink-muted inline-flex h-11 items-center justify-center rounded-xl px-3 text-center text-xs font-semibold">
                                                {allReady
                                                    ? 'Semua siap · Menunggu tuan rumah'
                                                    : 'Menunggu tuan rumah memulai'}
                                            </div>
                                        )}

                                        <p className="text-ink-muted pt-1 text-center text-[11px] leading-4">
                                            {startBlockedReason ??
                                                'Semua pemain sudah siap. Tuan rumah bisa memulai permainan.'}
                                        </p>
                                    </div>
                                </section>
                            </aside>
                        </div>

                        <div className="border-line shadow-card mt-2.5 shrink-0 rounded-2xl border bg-white p-2 md:hidden">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={
                                        !currentMe?.seat_color || pendingAction
                                    }
                                    onClick={handleToggleReady}
                                    aria-pressed={Boolean(currentMe?.is_ready)}
                                    className={`inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
                                        currentMe?.is_ready
                                            ? 'border-success/25 bg-success/10 text-success-ink border'
                                            : 'border-line text-ink hover:bg-surface-muted border bg-white'
                                    }`}
                                >
                                    {!currentMe?.seat_color ? (
                                        'Pilih kursi'
                                    ) : currentMe.is_ready ? (
                                        <>
                                            <CheckIcon className="h-4 w-4" />
                                            Siap
                                        </>
                                    ) : (
                                        'Tandai siap'
                                    )}
                                </button>

                                {isHost ? (
                                    <button
                                        type="button"
                                        disabled={!allReady || pendingAction}
                                        onClick={handleStartMatch}
                                        className="bg-brand hover:bg-brand-dark disabled:bg-surface-muted disabled:text-ink-muted inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed"
                                    >
                                        <DiceIcon className="h-4 w-4" />
                                        Mulai main
                                    </button>
                                ) : (
                                    <div className="bg-surface-muted text-ink-muted inline-flex h-11 flex-1 items-center justify-center rounded-xl px-2 text-center text-[11px] font-semibold">
                                        {allReady
                                            ? 'Tunggu tuan rumah'
                                            : 'Menunggu siap'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                )}
            </div>

            {rulesModalOpen && liveRoom && (
                <div
                    className="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[3px]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="room-rules-title"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            setRulesModalOpen(false);
                        }
                    }}
                >
                    <div className="animate-modal-enter border-line w-full max-w-sm rounded-[24px] border bg-white p-5 shadow-[0_24px_64px_-16px_rgba(32,43,58,0.3)]">
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h2
                                id="room-rules-title"
                                className="text-ink text-base font-semibold"
                            >
                                Pengaturan & aturan meja
                            </h2>
                            <button
                                type="button"
                                onClick={() => setRulesModalOpen(false)}
                                aria-label="Tutup aturan"
                                className="border-line text-ink-muted hover:bg-surface-muted hover:text-ink grid h-8 w-8 place-items-center rounded-full border bg-white transition"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <RoomSettingsSummary
                            playerCount={playerCount}
                            hostAdvantage={Boolean(liveRoom?.host_advantage)}
                            onToggleAdvantage={handleToggleAdvantage}
                            isHost={isHost}
                            pending={pendingAction}
                            onSelectPlayerCount={handleSelectPlayerCount}
                        />

                        {isHost && (
                            <button
                                type="button"
                                disabled={pendingAction}
                                onClick={() => {
                                    setRulesModalOpen(false);
                                    handleCreateNewRoom();
                                }}
                                className="border-line text-ink hover:bg-surface-muted mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border bg-white text-xs font-semibold transition"
                            >
                                Buat ruang baru
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
