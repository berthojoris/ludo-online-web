import Dice from '@/Components/Game/Dice';
import HowItWorksModal from '@/Components/Game/HowItWorksModal';
import {
    ArrowRightIcon,
    DiceIcon,
    InfoIcon,
    SparklesIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import LudoBoard, { BoardToken } from '@/Components/Game/LudoBoard';
import { PlayerColor, tokenPoint } from '@/lib/ludo';
import { User } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
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

export default function Home() {
    const { auth } = usePage().props as unknown as {
        auth?: { user: User | null };
    };
    const user = auth?.user ?? null;
    const tokens = previewTokens();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [howItWorksOpen, setHowItWorksOpen] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.location.hash === '#how-it-works',
    );

    useEffect(() => {
        const syncFromHash = () => {
            if (window.location.hash === '#how-it-works') {
                setHowItWorksOpen(true);
            }
        };

        window.addEventListener('hashchange', syncFromHash);

        return () => {
            window.removeEventListener('hashchange', syncFromHash);
        };
    }, []);

    const openHowItWorks = useCallback(() => {
        setHowItWorksOpen(true);

        if (window.location.hash !== '#how-it-works') {
            window.history.replaceState(null, '', '#how-it-works');
        }
    }, []);

    const closeHowItWorks = useCallback(() => {
        setHowItWorksOpen(false);

        if (window.location.hash === '#how-it-works') {
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}`,
            );
        }

        window.requestAnimationFrame(() => {
            triggerRef.current?.focus();
        });
    }, []);

    return (
        <>
            <Head title="Lempar. Berlomba. Kuasai papan.">
                <meta
                    name="description"
                    content="Papan Ludo yang bersih dan modern untuk pertandingan online cepat dan ruang privat."
                />
            </Head>

            <div className="relative min-h-screen overflow-x-clip">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden"
                >
                    <div className="bg-brand/10 absolute top-20 -left-32 h-80 w-80 rounded-full blur-3xl" />
                    <div className="bg-ludo-yellow/10 absolute top-44 -right-24 h-96 w-96 rounded-full blur-3xl" />
                    <div className="dot-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_72%)] opacity-40" />
                </div>

                <header className="border-line/60 bg-canvas/80 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-[72px] sm:px-6">
                        <Link
                            href={route('home')}
                            aria-label="Beranda Ludo Arena"
                            className="rounded-xl"
                        >
                            <Logo className="h-9 w-9" withWordmark />
                        </Link>

                        <nav className="flex items-center gap-1.5">
                            <button
                                ref={triggerRef}
                                type="button"
                                onClick={openHowItWorks}
                                aria-label="Cara bermain"
                                aria-haspopup="dialog"
                                aria-expanded={howItWorksOpen}
                                className="border-line/80 text-ink-muted hover:border-ink/15 hover:text-ink inline-flex h-9 items-center gap-1.5 rounded-full border bg-white/90 px-3 text-xs font-semibold shadow-sm transition hover:bg-white sm:h-auto sm:border-transparent sm:bg-transparent sm:px-3.5 sm:py-2 sm:text-sm sm:font-medium sm:shadow-none sm:hover:border-transparent sm:hover:bg-white"
                            >
                                <InfoIcon className="h-4 w-4 shrink-0 sm:hidden" />
                                <span className="hidden min-[360px]:inline">
                                    Cara bermain
                                </span>
                            </button>
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

                <main>
                    <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pt-16 lg:pb-20">
                        <div className="animate-fade-up">
                            <span className="border-line text-ink-muted inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] shadow-sm backdrop-blur">
                                <span className="flex gap-1" aria-hidden="true">
                                    <span className="bg-ludo-red h-1.5 w-1.5 rounded-full" />
                                    <span className="bg-ludo-green h-1.5 w-1.5 rounded-full" />
                                    <span className="bg-ludo-yellow h-1.5 w-1.5 rounded-full" />
                                    <span className="bg-ludo-blue h-1.5 w-1.5 rounded-full" />
                                </span>
                                MULTIPEMAIN ONLINE · 2–4 PEMAIN
                            </span>

                            <h1 className="text-ink mt-5 text-[2.75rem] leading-[1.04] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-[4.15rem]">
                                Lempar. Berlomba.
                                <br />
                                <span className="text-brand">
                                    Kuasai papannya.
                                </span>
                            </h1>

                            <p className="text-ink-muted mt-5 max-w-lg text-[15px] leading-7 sm:text-base">
                                Ludo klasik, dibangun ulang untuk pertandingan
                                singkat. Kumpulkan temanmu, lempar dadu, dan
                                antar setiap bidak ke garis akhir di papan yang
                                tidak menghalangi permainanmu.
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <Link
                                    href={route('play')}
                                    className="group bg-brand hover:bg-brand-dark inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl px-6 text-base font-semibold text-white shadow-[0_14px_30px_-12px_rgba(47,107,239,0.8)] transition active:scale-[0.985]"
                                >
                                    <DiceIcon className="h-5 w-5" />
                                    Main sekarang
                                    <ArrowRightIcon className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                                <div className="flex gap-3">
                                    <Link
                                        href={route('room')}
                                        className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex h-14 flex-1 items-center justify-center rounded-2xl border bg-white px-5 text-sm font-semibold whitespace-nowrap shadow-sm transition active:scale-[0.985]"
                                    >
                                        Buat ruang
                                    </Link>
                                    <Link
                                        href={`${route('room')}?join=1`}
                                        className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex h-14 flex-1 items-center justify-center rounded-2xl border bg-white px-5 text-sm font-semibold whitespace-nowrap shadow-sm transition active:scale-[0.985]"
                                    >
                                        Gabung ruang
                                    </Link>
                                </div>
                            </div>

                            <div className="text-ink-muted mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
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

                        <div className="animate-fade-up relative mx-auto w-full max-w-[520px] [animation-delay:120ms]">
                            <div
                                aria-hidden="true"
                                className="from-brand/15 to-ludo-yellow/20 absolute -inset-6 rounded-[3rem] bg-gradient-to-br via-transparent blur-2xl"
                            />
                            <div className="shadow-board relative rounded-[32px] border border-white/80 bg-white/75 p-2.5 backdrop-blur-sm sm:p-3">
                                <div className="bg-surface-muted/70 rounded-[26px] p-3 sm:p-4">
                                    <LudoBoard tokens={tokens} />
                                </div>

                                <div className="animate-float-soft border-line/80 shadow-card absolute top-8 -left-3 hidden items-center gap-2.5 rounded-2xl border bg-white/95 px-3 py-2 sm:flex">
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

                                <div className="border-line/80 shadow-card absolute -right-4 bottom-12 hidden items-center gap-2 rounded-full border bg-white/95 px-3 py-2 sm:flex">
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
                    </section>

                    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:pb-20">
                        <div className="bg-brand relative overflow-hidden rounded-[30px] px-6 py-8 text-white shadow-[0_24px_60px_-24px_rgba(47,107,239,0.65)] sm:px-10 sm:py-10">
                            <div
                                aria-hidden="true"
                                className="absolute -top-16 -right-10 h-52 w-52 rounded-full bg-white/10 blur-2xl"
                            />
                            <div
                                aria-hidden="true"
                                className="bg-ludo-yellow/20 absolute -bottom-20 left-1/3 h-52 w-52 rounded-full blur-3xl"
                            />
                            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                <div className="max-w-xl">
                                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-white">
                                        <SparklesIcon className="h-3.5 w-3.5" />
                                        MEJA KAMU SIAP
                                    </p>
                                    <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                                        Masuk dan lempar dadu pertama.
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-white">
                                        Coba papan latihan sekarang. Pencarian
                                        lawan online dan ruang privat hadir
                                        seiring mesin pertandingan selesai.
                                    </p>
                                </div>
                                <Link
                                    href={route('play')}
                                    className="text-brand-ink inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold shadow-sm transition hover:bg-white/90 active:scale-[0.985]"
                                >
                                    Buka papan
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="border-line/70 border-t">
                    <div className="text-ink-muted mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="flex items-center gap-2">
                            <Logo className="h-6 w-6" />
                            <span>
                                Ludo Arena · Papan yang lebih tenang untuk
                                pertandingan singkat.
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="bg-ludo-green h-1.5 w-1.5 rounded-full" />
                                Bahasa Indonesia
                            </span>
                        </div>
                    </div>
                </footer>
            </div>

            <HowItWorksModal
                open={howItWorksOpen}
                onClose={closeHowItWorks}
            />
        </>
    );
}
