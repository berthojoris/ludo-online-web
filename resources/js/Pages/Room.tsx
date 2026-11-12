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
import { Head, Link, usePage } from '@inertiajs/react';
import { CSSProperties, FormEvent, useEffect, useState } from 'react';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TABLE_SEATS: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];

const ROOM_RULES = [
    { label: 'Timer giliran', value: '15 detik' },
    { label: 'Keluar markas', value: 'Angka 6' },
    { label: 'Tiga kali angka 6', value: 'Hangus' },
    { label: 'Petak aman', value: '8 petak' },
];

type CopyState = 'idle' | 'code' | 'link' | 'error';
type ViewMode = 'lobby' | 'join';
type PlayerCount = 2 | 4;

function RoomSettingsSummary({
    playerCount,
    onSelectPlayerCount,
}: {
    playerCount: PlayerCount;
    onSelectPlayerCount: (count: PlayerCount) => void;
}) {
    return (
        <>
            <div>
                <span className="text-ink-muted block text-xs font-medium">
                    Kapasitas pemain
                </span>
                <div className="border-line bg-canvas mt-1.5 grid grid-cols-2 gap-1 rounded-xl border p-1">
                    {([2, 4] as PlayerCount[]).map((count) => (
                        <button
                            key={count}
                            type="button"
                            onClick={() => onSelectPlayerCount(count)}
                            aria-pressed={playerCount === count}
                            className={`h-8 rounded-lg text-xs font-semibold transition ${
                                playerCount === count
                                    ? 'text-ink bg-white shadow-sm'
                                    : 'text-ink-muted hover:text-ink'
                            }`}
                        >
                            {count} Pemain
                        </button>
                    ))}
                </div>
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

function generateRoomCode(): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.getRandomValues === 'function'
    ) {
        const values = new Uint32Array(6);
        crypto.getRandomValues(values);

        return Array.from(
            values,
            (value) => CODE_ALPHABET[value % CODE_ALPHABET.length],
        ).join('');
    }

    return Array.from(
        { length: 6 },
        () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
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
    const { auth } = page.props as unknown as {
        auth?: { user: User | null };
    };
    const { url } = page;
    const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const params = new URLSearchParams(query);
    const joinRequested = params.get('join') === '1';
    const codeFromUrl = normalizeCode(params.get('code') ?? '');

    const playerName = auth?.user?.name?.split(' ')[0] ?? 'Tamu';
    const [code, setCode] = useState(() => codeFromUrl || generateRoomCode());
    const [joinCode, setJoinCode] = useState(codeFromUrl);
    const [mode, setMode] = useState<ViewMode>(
        joinRequested && !codeFromUrl ? 'join' : 'lobby',
    );
    const [isGuest, setIsGuest] = useState(
        Boolean(codeFromUrl) || joinRequested,
    );
    const [playerCount, setPlayerCount] = useState<PlayerCount>(4);
    const [selectedColor, setSelectedColor] = useState<PlayerColor>(
        joinRequested ? 'green' : 'blue',
    );
    const [ready, setReady] = useState(false);
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const [rulesModalOpen, setRulesModalOpen] = useState(false);

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

    const hostColor: PlayerColor = selectedColor === 'red' ? 'blue' : 'red';
    const occupiedCount = isGuest ? 2 : 1;

    const shareLink =
        typeof window !== 'undefined'
            ? `${window.location.origin}/room?code=${code}`
            : `/room?code=${code}`;

    const cue = () => {
        void unlockAudio().then(playUiSound);
    };

    const copy = async (value: string, target: 'code' | 'link') => {
        cue();
        const copied = await copyText(value);
        setCopyState(copied ? target : 'error');
        window.setTimeout(() => setCopyState('idle'), 1800);
    };

    const handleJoin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (joinCode.length !== 6) {
            return;
        }

        cue();
        setCode(joinCode);
        setIsGuest(true);
        setSelectedColor((current) => (current === 'red' ? 'green' : current));
        setMode('lobby');
    };

    const switchMode = (next: ViewMode) => {
        cue();
        setMode(next);
    };

    const selectSeat = (color: PlayerColor) => {
        if (isGuest && color === hostColor) {
            return;
        }

        cue();
        setSelectedColor(color);
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
                                aria-selected={mode === 'lobby'}
                                onClick={() => switchMode('lobby')}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                    mode === 'lobby'
                                        ? 'text-ink bg-white shadow-sm'
                                        : 'text-ink-muted hover:text-ink'
                                }`}
                            >
                                Meja
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'join'}
                                onClick={() => switchMode('join')}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                    mode === 'join'
                                        ? 'text-ink bg-white shadow-sm'
                                        : 'text-ink-muted hover:text-ink'
                                }`}
                            >
                                Gabung
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5">
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
                            <span className="border-line text-ink-muted hidden items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-semibold sm:inline-flex">
                                <span
                                    className={`h-2 w-2 rounded-full ${
                                        ready ? 'bg-ludo-green' : 'bg-warning'
                                    }`}
                                />
                                {ready ? 'Siap main' : 'Menunggu'}
                            </span>
                        </div>
                    </div>
                </header>

                {mode === 'join' ? (
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
                                    onClick={() => {
                                        setIsGuest(false);
                                        switchMode('lobby');
                                    }}
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
                            <section className="flex min-h-0 flex-col gap-2.5 sm:gap-3">
                                <div className="border-line shadow-card flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white px-3.5 py-2.5 sm:px-4 sm:py-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div>
                                            <p className="text-ink-muted text-[11px] leading-none font-medium">
                                                Kode ruang
                                            </p>
                                            <p className="text-ink mt-1 font-mono text-lg font-semibold tracking-[0.22em] sm:text-2xl">
                                                {code}
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
                                            onClick={() => copy(code, 'code')}
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

                                <div
                                    className="relative grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3.5"
                                    role="group"
                                    aria-label="Kursi meja Ludo"
                                >
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

                                    {TABLE_SEATS.map((color) => {
                                        const config = PLAYER_CONFIG[color];
                                        const palette = config.palette;
                                        const isYou = selectedColor === color;
                                        const isHost =
                                            isGuest && color === hostColor;
                                        const occupied = isYou || isHost;

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

                                                    {isYou ? (
                                                        <span
                                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                                ready
                                                                    ? 'bg-success/10 text-success-ink'
                                                                    : 'bg-warning/10 text-warning-ink'
                                                            }`}
                                                        >
                                                            {ready
                                                                ? 'Siap'
                                                                : 'Belum siap'}
                                                        </span>
                                                    ) : isHost ? (
                                                        <span className="bg-success/10 text-success-ink shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                                            Siap
                                                        </span>
                                                    ) : (
                                                        <span className="bg-surface-muted text-ink-muted shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                                            Kosong
                                                        </span>
                                                    )}
                                                </div>

                                                {occupied ? (
                                                    <div className="mt-auto flex items-center gap-2.5 pt-2">
                                                        <span
                                                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold sm:h-10 sm:w-10 sm:text-sm"
                                                            style={{
                                                                background:
                                                                    palette.soft,
                                                                color: palette.text,
                                                            }}
                                                        >
                                                            {(isYou
                                                                ? playerName
                                                                : 'T'
                                                            )
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="text-ink truncate text-sm font-semibold sm:text-base">
                                                                {isYou
                                                                    ? playerName
                                                                    : 'Tuan rumah'}
                                                            </p>
                                                            <p className="text-ink-muted text-[11px] leading-tight">
                                                                {isYou
                                                                    ? isGuest
                                                                        ? 'Kamu · Tamu'
                                                                        : 'Kamu · Tuan rumah'
                                                                    : 'Pemilik ruang'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                selectSeat(
                                                                    color,
                                                                )
                                                            }
                                                            className="border-line text-ink hover:bg-surface-muted inline-flex h-8 items-center rounded-xl border bg-white px-2.5 text-xs font-semibold transition sm:h-9 sm:px-3"
                                                        >
                                                            Pakai warna
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
                                        <span className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                            Pratinjau
                                        </span>
                                    </div>

                                    <RoomSettingsSummary
                                        playerCount={playerCount}
                                        onSelectPlayerCount={(count) => {
                                            cue();
                                            setPlayerCount(count);
                                        }}
                                    />

                                    <div className="border-line/80 mt-auto flex flex-col gap-2 border-t pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                cue();
                                                setReady((value) => !value);
                                            }}
                                            aria-pressed={ready}
                                            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition ${
                                                ready
                                                    ? 'border-success/25 bg-success/10 text-success-ink border'
                                                    : 'border-line text-ink hover:bg-surface-muted border bg-white'
                                            }`}
                                        >
                                            {ready ? (
                                                <>
                                                    <CheckIcon className="h-4 w-4" />
                                                    Siap bermain
                                                </>
                                            ) : (
                                                'Tandai siap'
                                            )}
                                        </button>

                                        <Link
                                            href={route('play')}
                                            className="bg-brand hover:bg-brand-dark inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,107,239,0.8)] transition active:scale-[0.99]"
                                        >
                                            <DiceIcon className="h-4 w-4" />
                                            Mulai di papan latihan
                                        </Link>

                                        <p className="text-ink-muted pt-1 text-center text-[11px] leading-4">
                                            Sinkronisasi ruang online aktif saat
                                            backend match tersedia.
                                        </p>
                                    </div>
                                </section>
                            </aside>
                        </div>

                        <div className="border-line shadow-card mt-2.5 shrink-0 rounded-2xl border bg-white p-2 md:hidden">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        cue();
                                        setReady((value) => !value);
                                    }}
                                    aria-pressed={ready}
                                    className={`inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
                                        ready
                                            ? 'border-success/25 bg-success/10 text-success-ink border'
                                            : 'border-line text-ink hover:bg-surface-muted border bg-white'
                                    }`}
                                >
                                    {ready ? (
                                        <>
                                            <CheckIcon className="h-4 w-4" />
                                            Siap
                                        </>
                                    ) : (
                                        'Tandai siap'
                                    )}
                                </button>

                                <Link
                                    href={route('play')}
                                    className="bg-brand hover:bg-brand-dark inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition active:scale-[0.99]"
                                >
                                    <DiceIcon className="h-4 w-4" />
                                    Mulai latihan
                                </Link>
                            </div>
                        </div>
                    </main>
                )}
            </div>

            {rulesModalOpen && (
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
                            onSelectPlayerCount={(count) => {
                                cue();
                                setPlayerCount(count);
                            }}
                        />

                        <p className="text-ink-muted mt-3 text-center text-[11px]">
                            Pratinjau lobi lokal · pilih warna kursi langsung di
                            meja.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
