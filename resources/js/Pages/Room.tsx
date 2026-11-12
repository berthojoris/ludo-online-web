import {
    ArrowRightIcon,
    CheckIcon,
    ChevronLeftIcon,
    CopyIcon,
    HashIcon,
    InfoIcon,
    LinkIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import { User } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type CopyState = 'idle' | 'code' | 'link' | 'error';

type Seat =
    | {
          kind: 'you';
          name: string;
          label: string;
          ready: boolean;
      }
    | {
          kind: 'host';
          name: string;
          label: string;
      }
    | {
          kind: 'empty';
          name: string;
          label: string;
      };

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
        () =>
            CODE_ALPHABET[
                Math.floor(Math.random() * CODE_ALPHABET.length)
            ],
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

    const playerName = auth?.user?.name?.split(' ')[0] ?? 'Guest';
    const [code, setCode] = useState(
        () => codeFromUrl || generateRoomCode(),
    );
    const [joinCode, setJoinCode] = useState(codeFromUrl);
    const [showJoinForm, setShowJoinForm] = useState(
        joinRequested && !codeFromUrl,
    );
    const [isGuest] = useState(joinRequested);
    const [ready, setReady] = useState(false);
    const [copyState, setCopyState] = useState<CopyState>('idle');

    const shareLink =
        typeof window !== 'undefined'
            ? `${window.location.origin}/room?code=${code}`
            : `/room?code=${code}`;

    const copy = async (
        value: string,
        target: 'code' | 'link',
    ) => {
        const copied = await copyText(value);
        setCopyState(copied ? target : 'error');
        window.setTimeout(() => setCopyState('idle'), 1800);
    };

    const handleJoin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (joinCode.length !== 6) {
            return;
        }

        setCode(joinCode);
        setShowJoinForm(false);
    };

    const seats: Seat[] = isGuest
        ? [
              {
                  kind: 'host',
                  name: 'Room host',
                  label: 'Host',
              },
              {
                  kind: 'you',
                  name: playerName,
                  label: 'You',
                  ready,
              },
              {
                  kind: 'empty',
                  name: 'Open seat',
                  label: 'Waiting',
              },
              {
                  kind: 'empty',
                  name: 'Open seat',
                  label: 'Waiting',
              },
          ]
        : [
              {
                  kind: 'you',
                  name: playerName,
                  label: 'Host',
                  ready,
              },
              {
                  kind: 'empty',
                  name: 'Open seat',
                  label: 'Waiting',
              },
              {
                  kind: 'empty',
                  name: 'Open seat',
                  label: 'Waiting',
              },
              {
                  kind: 'empty',
                  name: 'Open seat',
                  label: 'Waiting',
              },
          ];

    return (
        <>
            <Head title="Private room" />

            <div className="relative min-h-screen overflow-x-clip">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden"
                >
                    <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
                    <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-ludo-yellow/10 blur-3xl" />
                    <div className="dot-grid absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
                </div>

                <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <Link
                                href={route('home')}
                                aria-label="Back to home"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-ink-muted shadow-sm transition hover:text-ink"
                            >
                                <ChevronLeftIcon className="h-4.5 w-4.5" />
                            </Link>
                            <Link href={route('home')} className="rounded-lg">
                                <Logo className="h-8 w-8" withWordmark compact />
                            </Link>
                            <span className="hidden rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:inline-flex">
                                Room
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {showJoinForm ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-muted">
                                    <InfoIcon className="h-3.5 w-3.5" />
                                    UI preview
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1.5 text-[11px] font-semibold text-warning-ink">
                                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                                    Waiting for players
                                </span>
                            )}
                            <Link
                                href={route('home')}
                                className="hidden rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-white hover:text-ink sm:inline-flex"
                            >
                                Exit
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
                    {showJoinForm ? (
                        <div className="mx-auto max-w-md animate-fade-up">
                            <div className="rounded-[28px] border border-line/80 bg-white p-6 shadow-card sm:p-8">
                                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand-ink">
                                    <HashIcon className="h-6 w-6" />
                                </span>
                                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
                                    Join a room
                                </h1>
                                <p className="mt-2 text-sm leading-6 text-ink-muted">
                                    Enter the six-character code your host
                                    shared. No account needed to look around.
                                </p>

                                <form
                                    onSubmit={handleJoin}
                                    className="mt-6"
                                >
                                    <label
                                        htmlFor="room-code"
                                        className="text-xs font-semibold text-ink"
                                    >
                                        Room code
                                    </label>
                                    <input
                                        id="room-code"
                                        value={joinCode}
                                        onChange={(event) =>
                                            setJoinCode(
                                                normalizeCode(
                                                    event.target.value,
                                                ),
                                            )
                                        }
                                        inputMode="text"
                                        autoCapitalize="characters"
                                        autoComplete="off"
                                        spellCheck={false}
                                        maxLength={6}
                                        placeholder="ABC123"
                                        aria-label="Six character room code"
                                        className="mt-2 h-16 w-full rounded-2xl border border-line bg-surface-muted/60 px-4 text-center text-2xl font-semibold uppercase tracking-[0.32em] text-ink transition placeholder:text-ink-muted/40 focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10"
                                    />

                                    <button
                                        type="submit"
                                        disabled={joinCode.length !== 6}
                                        className="mt-3 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.8)] transition hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted disabled:shadow-none"
                                    >
                                        Join room
                                        <ArrowRightIcon className="h-4 w-4" />
                                    </button>
                                </form>

                                <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-[11px] leading-5 text-ink-muted">
                                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                    Room joining is a UI preview. Live room
                                    sync arrives with the matchmaking backend.
                                </p>

                                <Link
                                    href={route('home')}
                                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-ink"
                                >
                                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                                    Back to home
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-up">
                            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-ink">
                                        PRIVATE ROOM
                                    </p>
                                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                                        {isGuest
                                            ? 'You joined the room.'
                                            : 'Your table is ready.'}
                                    </h1>
                                    <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
                                        Share the code, wait for friends, and
                                        start when everyone is seated. This
                                        preview keeps the lobby client-side.
                                    </p>
                                </div>
                                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm">
                                    <UsersIcon className="h-4 w-4" />
                                    1 of 4 seated
                                </span>
                            </div>

                            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                                <div className="space-y-4">
                                    <section className="rounded-[24px] border border-brand/15 bg-brand/[0.04] p-5 sm:p-6">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-[10px] font-semibold tracking-[0.18em] text-brand-ink">
                                                    ROOM CODE
                                                </p>
                                                <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.3em] text-ink sm:text-4xl">
                                                    {code}
                                                </p>
                                                <p className="mt-2 text-xs text-ink-muted">
                                                    Six characters. Case does
                                                    not matter.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copy(code, 'code')
                                                }
                                                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-xs font-semibold text-ink shadow-sm transition hover:border-ink/15 hover:bg-surface-muted"
                                            >
                                                {copyState === 'code' ? (
                                                    <>
                                                        <CheckIcon className="h-4 w-4 text-success-ink" />
                                                        Copied
                                                    </>
                                                ) : copyState ===
                                                  'error' ? (
                                                    <>
                                                        <CopyIcon className="h-4 w-4" />
                                                        Copy failed
                                                    </>
                                                ) : (
                                                    <>
                                                        <CopyIcon className="h-4 w-4" />
                                                        Copy code
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <h2 className="text-sm font-semibold text-ink">
                                                Players
                                            </h2>
                                            <span className="text-[11px] font-medium text-ink-muted">
                                                Seat 1 is the host
                                            </span>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {seats.map((seat, index) => (
                                                <div
                                                    key={`${seat.kind}-${index}`}
                                                    className={`flex min-h-[88px] items-center gap-3 rounded-[20px] border p-4 ${
                                                        seat.kind === 'empty'
                                                            ? 'border-dashed border-line bg-surface-muted/35'
                                                            : 'border-line/80 bg-white shadow-sm'
                                                    }`}
                                                >
                                                    {seat.kind === 'empty' ? (
                                                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-dashed border-line bg-white text-lg font-medium text-ink-muted/60">
                                                            +
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold ${
                                                                seat.kind ===
                                                                'host'
                                                                    ? 'bg-ink text-white'
                                                                    : 'bg-brand/10 text-brand-ink'
                                                            }`}
                                                        >
                                                            {seat.name
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                    )}

                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={`truncate text-sm font-semibold ${
                                                                seat.kind ===
                                                                'empty'
                                                                    ? 'text-ink-muted'
                                                                    : 'text-ink'
                                                            }`}
                                                        >
                                                            {seat.name}
                                                        </p>
                                                        <div className="mt-1 flex items-center gap-1.5">
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
                                                                    seat.kind ===
                                                                    'host'
                                                                        ? 'bg-ink/8 text-ink-muted'
                                                                        : seat.kind ===
                                                                            'you'
                                                                          ? 'bg-brand/10 text-brand-ink'
                                                                          : 'bg-surface-muted text-ink-muted'
                                                                }`}
                                                            >
                                                                {seat.label}
                                                            </span>
                                                            {seat.kind ===
                                                                'you' && (
                                                                <span
                                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                                                        seat.ready
                                                                            ? 'bg-success/10 text-success-ink'
                                                                            : 'bg-warning/10 text-warning-ink'
                                                                    }`}
                                                                >
                                                                    {seat.ready
                                                                        ? 'Ready'
                                                                        : 'Not ready'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {seat.kind === 'empty' && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                copy(
                                                                    shareLink,
                                                                    'link',
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-brand-ink transition hover:bg-brand/8"
                                                        >
                                                            <LinkIcon className="h-3.5 w-3.5" />
                                                            Invite
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                <aside className="space-y-4">
                                    <section className="rounded-[24px] border border-line/80 bg-white p-4 shadow-card sm:p-5">
                                        <h2 className="text-sm font-semibold text-ink">
                                            Match actions
                                        </h2>
                                        <div className="mt-4 flex flex-col gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setReady((value) => !value)
                                                }
                                                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition ${
                                                    ready
                                                        ? 'border border-success/20 bg-success/10 text-success-ink'
                                                        : 'bg-brand text-white shadow-[0_10px_22px_-12px_rgba(47,107,239,0.8)] hover:bg-brand-dark'
                                                }`}
                                            >
                                                {ready ? (
                                                    <>
                                                        <CheckIcon className="h-4 w-4" />
                                                        Ready to play
                                                    </>
                                                ) : (
                                                    'Mark as ready'
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copy(shareLink, 'link')
                                                }
                                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white text-xs font-semibold text-ink transition hover:border-ink/15 hover:bg-surface-muted"
                                            >
                                                {copyState === 'link' ? (
                                                    <>
                                                        <CheckIcon className="h-4 w-4 text-success-ink" />
                                                        Invite copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <LinkIcon className="h-4 w-4" />
                                                        Copy invite link
                                                    </>
                                                )}
                                            </button>

                                            <Link
                                                href={route('play')}
                                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-xs font-semibold text-white transition hover:bg-ink/90 active:scale-[0.99]"
                                            >
                                                <ArrowRightIcon className="h-4 w-4" />
                                                Start practice match
                                            </Link>

                                            <Link
                                                href={route('home')}
                                                className="inline-flex h-10 items-center justify-center rounded-xl text-xs font-semibold text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                                            >
                                                Leave room
                                            </Link>
                                        </div>

                                        <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-[11px] leading-5 text-ink-muted">
                                            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                            Room codes and seats are a UI
                                            preview. Online room start will
                                            unlock when matchmaking is
                                            connected.
                                        </p>
                                    </section>

                                    <section className="rounded-[24px] border border-line/80 bg-white p-4 shadow-card sm:p-5">
                                        <h2 className="text-sm font-semibold text-ink">
                                            House rules
                                        </h2>
                                        <ul className="mt-3 space-y-2.5">
                                            {[
                                                'Roll a 6 to bring a token out of base.',
                                                'Land on a rival to send it home, unless the square is safe.',
                                                'An exact roll is required to finish.',
                                                'Online turns are 15 seconds each.',
                                            ].map((rule) => (
                                                <li
                                                    key={rule}
                                                    className="flex items-start gap-2 text-[11px] leading-5 text-ink-muted"
                                                >
                                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/50" />
                                                    {rule}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </aside>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
