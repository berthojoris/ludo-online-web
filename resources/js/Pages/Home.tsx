import Dice from '@/Components/Game/Dice';
import HowItWorksModal from '@/Components/Game/HowItWorksModal';
import { InfoIcon } from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import LudoBoard, { BoardToken } from '@/Components/Game/LudoBoard';
import { PlayerColor, tokenPoint } from '@/lib/ludo';
import { User } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const PREVIEW_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

function previewTokens(): BoardToken[] {
    return PREVIEW_COLORS.flatMap((color) =>
        [0, 1, 2, 3].map((tokenIndex) => ({
            id: `${color}-${tokenIndex}`,
            color,
            point: tokenPoint(color, tokenIndex === 0 ? 8 : -1, tokenIndex),
        })),
    );
}

/**
 * Measures the flexible board container and returns the largest square that
 * fits inside it (same pattern as useBoardSize in Play.tsx).
 */
function usePreviewBoardSize() {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(0);

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const measure = () => {
            const rect = element.getBoundingClientRect();
            const next = Math.floor(Math.min(rect.width, rect.height));

            setSize(next > 0 ? Math.max(140, next) : 0);
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(element);
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, []);

    return [ref, size] as const;
}

export default function Home() {
    const { auth, howItWorksOpen: initialHowItWorksOpen } = usePage()
        .props as unknown as {
        auth?: { user: User | null };
        howItWorksOpen?: boolean;
    };
    const user = auth?.user ?? null;
    const tokens = previewTokens();
    const triggerRef = useRef<HTMLAnchorElement>(null);
    const [boardAreaRef, boardSize] = usePreviewBoardSize();
    const [howItWorksOpen, setHowItWorksOpen] = useState(
        Boolean(initialHowItWorksOpen),
    );

    useEffect(() => {
        setHowItWorksOpen(Boolean(initialHowItWorksOpen));
    }, [initialHowItWorksOpen]);

    const openHowItWorks = useCallback(() => {
        setHowItWorksOpen(true);
    }, []);

    const closeHowItWorks = useCallback(() => {
        setHowItWorksOpen(false);

        router.visit(route('home'), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
            onFinish: () => {
                window.requestAnimationFrame(() => {
                    triggerRef.current?.focus();
                });
            },
        });
    }, []);

    const startPlaying = useCallback(() => {
        setHowItWorksOpen(false);
    }, []);

    return (
        <>
            <Head
                title={
                    howItWorksOpen
                        ? 'Cara bermain'
                        : 'Lempar. Berlomba. Kuasai papan.'
                }
            >
                <meta
                    name="description"
                    content="Papan Ludo yang bersih dan modern untuk pertandingan online cepat dan ruang privat."
                />
            </Head>

            <div className="relative flex h-screen min-h-0 w-full flex-col overflow-x-hidden overflow-y-auto supports-[height:100dvh]:h-[100dvh]">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden"
                >
                    <div className="bg-brand/10 absolute top-20 -left-32 h-80 w-80 rounded-full blur-3xl" />
                    <div className="bg-ludo-yellow/10 absolute top-44 -right-24 h-96 w-96 rounded-full blur-3xl" />
                    <div className="dot-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_72%)] opacity-40" />
                </div>

                <header className="border-line/60 bg-canvas/80 z-40 shrink-0 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1 sm:min-h-16 sm:flex-nowrap sm:px-6 sm:py-0 [@media(max-height:520px)_and_(orientation:landscape)]:min-h-11 [@media(max-height:520px)_and_(orientation:landscape)]:py-0">
                        <Link
                            href={route('home')}
                            aria-label="Beranda Ludo Arena"
                            className="rounded-xl"
                        >
                            <Logo
                                className="h-8 w-8 sm:h-9 sm:w-9"
                                withWordmark
                            />
                        </Link>

                        <nav className="flex flex-wrap items-center justify-end gap-1.5">
                            <Link
                                ref={triggerRef}
                                href={route('how-it-works')}
                                onClick={openHowItWorks}
                                preserveScroll
                                preserveState
                                prefetch
                                aria-label="Cara bermain"
                                aria-haspopup="dialog"
                                aria-expanded={howItWorksOpen}
                                className="border-line/80 text-ink hover:border-ink/15 sm:text-ink-muted sm:hover:text-ink inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border bg-white/95 px-3 text-xs font-semibold shadow-sm transition hover:bg-white sm:h-auto sm:min-w-0 sm:border-transparent sm:bg-transparent sm:px-3.5 sm:py-2 sm:text-sm sm:font-medium sm:shadow-none sm:hover:border-transparent sm:hover:bg-white"
                            >
                                <InfoIcon className="h-5 w-5 shrink-0 sm:hidden" />
                                <span className="hidden min-[360px]:inline">
                                    Cara bermain
                                </span>
                            </Link>
                            {user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="border-line text-ink hover:border-ink/15 inline-flex items-center gap-2 rounded-full border bg-white px-2 py-1.5 pr-3 text-sm font-semibold shadow-sm transition"
                                >
                                    <span className="bg-brand/10 text-brand-ink grid h-7 w-7 place-items-center rounded-full text-xs font-bold">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="hidden max-w-28 truncate sm:inline">
                                        {user.name}
                                    </span>
                                </Link>
                            ) : null}
                        </nav>
                    </div>
                </header>

                <main className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 sm:px-6 lg:flex-row lg:items-stretch lg:gap-10 [@media(max-height:520px)_and_(orientation:landscape)]:flex-row [@media(max-height:520px)_and_(orientation:landscape)]:items-stretch [@media(max-height:520px)_and_(orientation:landscape)]:gap-6">
                    {/* Hero copy column */}
                    <div className="animate-fade-up flex min-h-0 shrink-0 flex-col items-center pt-[clamp(6px,1.6dvh,40px)] text-center lg:min-w-0 lg:flex-1 lg:items-start lg:justify-center lg:pt-0 lg:text-left [@media(max-height:520px)_and_(orientation:landscape)]:min-w-0 [@media(max-height:520px)_and_(orientation:landscape)]:flex-1 [@media(max-height:520px)_and_(orientation:landscape)]:items-start [@media(max-height:520px)_and_(orientation:landscape)]:justify-center [@media(max-height:520px)_and_(orientation:landscape)]:pt-0 [@media(max-height:520px)_and_(orientation:landscape)]:text-left">
                        <span className="border-line text-ink-muted inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] shadow-sm backdrop-blur sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[11px] [@media(max-height:520px)_and_(orientation:landscape)]:py-0.5 [@media(max-height:520px)_and_(orientation:landscape)]:text-[9px]">
                            <span className="flex gap-1" aria-hidden="true">
                                <span className="bg-ludo-red h-1.5 w-1.5 rounded-full" />
                                <span className="bg-ludo-green h-1.5 w-1.5 rounded-full" />
                                <span className="bg-ludo-yellow h-1.5 w-1.5 rounded-full" />
                                <span className="bg-ludo-blue h-1.5 w-1.5 rounded-full" />
                            </span>
                            MULTIPEMAIN ONLINE · 2–4 PEMAIN
                        </span>

                        <h1 className="text-ink mt-[clamp(6px,1.4dvh,20px)] text-[clamp(1.45rem,5.4vmin,3.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] [@media(max-height:520px)_and_(orientation:landscape)]:mt-2 [@media(max-height:520px)_and_(orientation:landscape)]:text-[clamp(1.25rem,7.5dvh,2rem)]">
                            Lempar. Berlomba.
                            <br />
                            <span className="text-brand">Kuasai papannya.</span>
                        </h1>

                        <p className="text-ink-muted mt-[clamp(6px,1.4dvh,20px)] max-w-lg text-[clamp(0.72rem,2.1vmin,1rem)] leading-[1.5] [@media(max-height:520px)_and_(orientation:landscape)]:mt-2 [@media(max-height:520px)_and_(orientation:landscape)]:text-[clamp(0.68rem,2.6dvh,0.8rem)] [@media(max-height:520px)_and_(orientation:landscape)]:leading-[1.45]">
                            Ludo klasik, dibangun ulang untuk pertandingan
                            singkat. Kumpulkan temanmu, lempar dadu, dan antar
                            setiap bidak ke garis akhir di papan yang tidak
                            menghalangi permainanmu.
                        </p>

                        <div className="mt-[clamp(8px,1.8dvh,32px)] flex w-full max-w-md gap-2 sm:max-w-lg sm:gap-2.5 lg:w-auto lg:max-w-none [@media(max-height:520px)_and_(orientation:landscape)]:mt-2.5 [@media(max-height:520px)_and_(orientation:landscape)]:w-auto [@media(max-height:520px)_and_(orientation:landscape)]:gap-1.5">
                            <Link
                                href={route('room')}
                                className="bg-brand hover:bg-brand-dark inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-5 text-sm font-semibold whitespace-nowrap text-white shadow-[0_14px_30px_-12px_rgba(47,107,239,0.8)] transition active:scale-[0.985] sm:h-14 lg:flex-none [@media(max-height:520px)_and_(orientation:landscape)]:h-11 [@media(max-height:520px)_and_(orientation:landscape)]:px-4"
                            >
                                Buat ruang
                            </Link>
                            <Link
                                href={`${route('room')}?join=1`}
                                className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex h-11 flex-1 items-center justify-center rounded-2xl border bg-white px-5 text-sm font-semibold whitespace-nowrap shadow-sm transition active:scale-[0.985] sm:h-14 lg:flex-none [@media(max-height:520px)_and_(orientation:landscape)]:h-11 [@media(max-height:520px)_and_(orientation:landscape)]:px-4"
                            >
                                Gabung ruang
                            </Link>
                        </div>

                        <div className="text-ink-muted mt-[clamp(6px,1.6dvh,28px)] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-[clamp(6px,1.6dvh,40px)] text-[10px] font-medium sm:text-xs lg:justify-start lg:pb-0 [@media(max-height:520px)_and_(orientation:landscape)]:mt-2 [@media(max-height:520px)_and_(orientation:landscape)]:justify-start [@media(max-height:520px)_and_(orientation:landscape)]:pb-0 [@media(max-height:520px)_and_(orientation:landscape)]:text-[9px]">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="bg-ludo-green h-1.5 w-1.5 rounded-full" />
                                Gratis dimainkan
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="bg-ludo-blue h-1.5 w-1.5 rounded-full" />
                                Tanpa unduhan
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="bg-ludo-yellow h-1.5 w-1.5 rounded-full" />
                                Pertandingan singkat
                            </span>
                        </div>
                    </div>

                    {/* Board column: flexible area measured by ResizeObserver */}
                    <div
                        ref={boardAreaRef}
                        className="animate-fade-up relative mx-auto flex min-h-0 w-full min-w-0 flex-1 items-center justify-center [animation-delay:120ms] lg:max-w-[560px] [@media(max-height:520px)_and_(orientation:landscape)]:mx-0 [@media(max-height:520px)_and_(orientation:landscape)]:w-auto [@media(max-height:520px)_and_(orientation:landscape)]:max-w-none"
                    >
                        {boardSize > 0 && (
                            <div
                                className="relative"
                                style={{
                                    width: Math.min(boardSize, 520),
                                    height: Math.min(boardSize, 520),
                                }}
                            >
                                <div
                                    aria-hidden="true"
                                    className="from-brand/15 to-ludo-yellow/20 absolute -inset-4 rounded-[3rem] bg-gradient-to-br via-transparent blur-2xl sm:-inset-6"
                                />
                                <div className="shadow-board relative h-full w-full rounded-[32px] border border-white/80 bg-white/75 p-1.5 backdrop-blur-sm sm:p-3">
                                    <div className="bg-surface-muted/70 h-full w-full rounded-[26px] p-2 sm:p-4">
                                        <LudoBoard
                                            tokens={tokens}
                                            className="h-full w-full"
                                        />
                                    </div>

                                    <div className="animate-float-soft border-line/80 shadow-card absolute top-8 -left-3 z-30 hidden items-center gap-2.5 rounded-2xl border bg-white/95 px-3 py-2 sm:flex [@media(max-height:520px)_and_(orientation:landscape)]:hidden">
                                        <Dice value={6} className="h-9 w-9" />
                                        <div>
                                            <p className="text-ink text-[11px] font-semibold">
                                                Dapat 6
                                            </p>
                                            <p className="text-ink-muted text-[10px]">
                                                Lemparan tambahan
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border-line/80 shadow-card absolute -right-4 bottom-12 z-30 hidden items-center gap-2 rounded-full border bg-white/95 px-3 py-2 sm:flex [@media(max-height:520px)_and_(orientation:landscape)]:hidden">
                                        <span className="relative flex h-2 w-2">
                                            <span className="bg-ludo-green absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                                            <span className="bg-ludo-green relative inline-flex h-2 w-2 rounded-full" />
                                        </span>
                                        <span className="text-ink text-[11px] font-semibold">
                                            Giliran Hijau
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                <footer className="border-line/70 relative shrink-0 border-t pb-[env(safe-area-inset-bottom)]">
                    <div className="text-ink-muted mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-[11px] sm:px-6 sm:py-3 sm:text-xs [@media(max-height:520px)_and_(orientation:landscape)]:py-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                            <Logo className="h-5 w-5 shrink-0" />
                            <span className="sm:hidden">
                                Ludo Arena · Papan yang tenang.
                            </span>
                            <span className="hidden sm:inline">
                                Ludo Arena · Papan yang lebih tenang untuk
                                pertandingan singkat.
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="bg-ludo-green h-1.5 w-1.5 rounded-full" />
                                <span className="sm:hidden">ID</span>
                                <span className="hidden sm:inline">
                                    Bahasa Indonesia
                                </span>
                            </span>
                        </div>
                    </div>
                </footer>
            </div>

            <HowItWorksModal
                open={howItWorksOpen}
                onClose={closeHowItWorks}
                onStart={startPlaying}
            />
        </>
    );
}
