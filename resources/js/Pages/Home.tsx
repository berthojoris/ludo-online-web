import Dice from '@/Components/Game/Dice';
import {
    ArrowRightIcon,
    DiceIcon,
    LinkIcon,
    ShieldIcon,
    SparklesIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import LudoBoard, { BoardToken } from '@/Components/Game/LudoBoard';
import { PlayerColor, tokenPoint } from '@/lib/ludo';
import { User } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

const PREVIEW_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

function previewTokens(): BoardToken[] {
    return PREVIEW_COLORS.flatMap((color) =>
        [0, 1, 2, 3].map((tokenIndex) => ({
            id: `${color}-${tokenIndex}`,
            color,
            point: tokenPoint(
                color,
                tokenIndex === 0 ? 8 : -1,
                tokenIndex,
            ),
        })),
    );
}

const FEATURES = [
    {
        icon: UsersIcon,
        title: 'Quick matches',
        body: 'A board-first layout for two to four players, with clear turns and no clutter between you and the game.',
        tint: 'bg-brand/10 text-brand',
    },
    {
        icon: LinkIcon,
        title: 'Private rooms',
        body: 'Create a room, share a short code, and keep a seat open for the friends you actually want to play with.',
        tint: 'bg-ludo-green/12 text-ludo-green',
    },
    {
        icon: ShieldIcon,
        title: 'Designed for fair play',
        body: 'Server-owned dice and move validation are the foundation of the match engine, never client-side trust.',
        tint: 'bg-ludo-yellow/15 text-ludo-yellow',
    },
];

export default function Home() {
    const { auth } = usePage().props as unknown as {
        auth?: { user: User | null };
    };
    const user = auth?.user ?? null;
    const tokens = previewTokens();

    return (
        <>
            <Head title="Roll. Race. Rule the board.">
                <meta
                    name="description"
                    content="A clean, modern Ludo board for quick online matches and private rooms."
                />
            </Head>

            <div className="relative min-h-screen overflow-x-clip">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden"
                >
                    <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
                    <div className="absolute -right-24 top-44 h-96 w-96 rounded-full bg-ludo-yellow/10 blur-3xl" />
                    <div className="dot-grid absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
                </div>

                <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-[72px] sm:px-6">
                        <Link
                            href={route('home')}
                            aria-label="Ludo Arena home"
                            className="rounded-xl"
                        >
                            <Logo className="h-9 w-9" withWordmark />
                        </Link>

                        <nav className="flex items-center gap-1.5">
                            <a
                                href="#how-it-works"
                                className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:bg-white hover:text-ink sm:inline-flex"
                            >
                                How it works
                            </a>
                            {user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-2 py-1.5 pr-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/15"
                                >
                                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand-ink">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="hidden max-w-28 truncate sm:inline">
                                        {user.name}
                                    </span>
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={route('login')}
                                        className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:bg-white hover:text-ink sm:inline-flex"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={route('register')}
                                        className="inline-flex items-center rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/15 hover:bg-surface-muted"
                                    >
                                        Create account
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                <main>
                    <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pb-24 lg:pt-20">
                        <div className="animate-fade-up">
                            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-ink-muted shadow-sm backdrop-blur">
                                <span className="flex gap-1" aria-hidden="true">
                                    <span className="h-1.5 w-1.5 rounded-full bg-ludo-red" />
                                    <span className="h-1.5 w-1.5 rounded-full bg-ludo-green" />
                                    <span className="h-1.5 w-1.5 rounded-full bg-ludo-yellow" />
                                    <span className="h-1.5 w-1.5 rounded-full bg-ludo-blue" />
                                </span>
                                ONLINE MULTIPLAYER · 2–4 PLAYERS
                            </span>

                            <h1 className="mt-5 text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[4.15rem]">
                                Roll. Race.
                                <br />
                                <span className="text-brand">Rule the board.</span>
                            </h1>

                            <p className="mt-5 max-w-lg text-[15px] leading-7 text-ink-muted sm:text-base">
                                Classic Ludo, rebuilt for quick matches. Gather
                                your friends, roll the dice, and race every
                                token home on a board that stays out of your
                                way.
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <Link
                                    href={route('play')}
                                    className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-brand px-6 text-base font-semibold text-white shadow-[0_14px_30px_-12px_rgba(47,107,239,0.8)] transition hover:bg-brand-dark active:scale-[0.985]"
                                >
                                    <DiceIcon className="h-5 w-5" />
                                    Play online
                                    <ArrowRightIcon className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                                <div className="flex gap-3">
                                    <Link
                                        href={route('room')}
                                        className="inline-flex h-14 flex-1 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-white px-5 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/15 hover:bg-surface-muted active:scale-[0.985]"
                                    >
                                        Create room
                                    </Link>
                                    <Link
                                        href={`${route('room')}?join=1`}
                                        className="inline-flex h-14 flex-1 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-white px-5 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/15 hover:bg-surface-muted active:scale-[0.985]"
                                    >
                                        Join room
                                    </Link>
                                </div>
                            </div>

                            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-ink-muted">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-ludo-green" />
                                    Free to play
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-ludo-blue" />
                                    No download
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-ludo-yellow" />
                                    Short matches
                                </span>
                            </div>
                        </div>

                        <div className="relative mx-auto w-full max-w-[520px] animate-fade-up [animation-delay:120ms]">
                            <div
                                aria-hidden="true"
                                className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-brand/15 via-transparent to-ludo-yellow/20 blur-2xl"
                            />
                            <div className="relative rounded-[32px] border border-white/80 bg-white/75 p-2.5 shadow-board backdrop-blur-sm sm:p-3">
                                <div className="rounded-[26px] bg-surface-muted/70 p-3 sm:p-4">
                                    <LudoBoard tokens={tokens} />
                                </div>

                                <div className="absolute -left-3 top-8 hidden animate-float-soft items-center gap-2.5 rounded-2xl border border-line/80 bg-white/95 px-3 py-2 shadow-card sm:flex">
                                    <Dice value={6} className="h-9 w-9" />
                                    <div>
                                        <p className="text-[11px] font-semibold text-ink">
                                            Rolled 6
                                        </p>
                                        <p className="text-[10px] text-ink-muted">
                                            Extra turn
                                        </p>
                                    </div>
                                </div>

                                <div className="absolute -right-4 bottom-12 hidden items-center gap-2 rounded-full border border-line/80 bg-white/95 px-3 py-2 shadow-card sm:flex">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ludo-green opacity-60" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-ludo-green" />
                                    </span>
                                    <span className="text-[11px] font-semibold text-ink">
                                        Green&apos;s turn
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        id="how-it-works"
                        className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24"
                    >
                        <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
                            <div>
                                <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-ink">
                                    BUILT FOR QUICK MATCHES
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                                    Everything you need for a clean game.
                                </h2>
                            </div>
                            <p className="hidden max-w-xs text-right text-sm leading-6 text-ink-muted sm:block">
                                Simple rules, bright tokens, and a board that
                                stays the hero.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            {FEATURES.map(({ icon: Icon, title, body, tint }) => (
                                <article
                                    key={title}
                                    className="group rounded-[24px] border border-line/80 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(32,43,58,0.35)] sm:p-6"
                                >
                                    <span
                                        className={`grid h-11 w-11 place-items-center rounded-2xl ${tint}`}
                                    >
                                        <Icon className="h-5.5 w-5.5" />
                                    </span>
                                    <h3 className="mt-4 text-base font-semibold text-ink">
                                        {title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-ink-muted">
                                        {body}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
                        <div className="relative overflow-hidden rounded-[30px] bg-brand px-6 py-8 text-white shadow-[0_24px_60px_-24px_rgba(47,107,239,0.65)] sm:px-10 sm:py-10">
                            <div
                                aria-hidden="true"
                                className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl"
                            />
                            <div
                                aria-hidden="true"
                                className="absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-ludo-yellow/20 blur-3xl"
                            />
                            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                <div className="max-w-xl">
                                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-white">
                                        <SparklesIcon className="h-3.5 w-3.5" />
                                        YOUR TABLE IS READY
                                    </p>
                                    <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                                        Jump in and take the first roll.
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-white">
                                        Try the practice board now. Online
                                        matchmaking and room play arrive as the
                                        match engine lands.
                                    </p>
                                </div>
                                <Link
                                    href={route('play')}
                                    className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-brand-ink shadow-sm transition hover:bg-white/90 active:scale-[0.985]"
                                >
                                    Open the board
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="border-t border-line/70">
                    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="flex items-center gap-2">
                            <Logo className="h-6 w-6" />
                            <span>Ludo Arena · A calmer board for quick matches.</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-ludo-green" />
                                English
                            </span>
                            <span>Bahasa Indonesia soon</span>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
