import {
    ArrowRightIcon,
    CloseIcon,
    DiceIcon,
    LinkIcon,
    ShieldIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import { Link } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

const FEATURES = [
    {
        icon: UsersIcon,
        title: 'Pertandingan cepat',
        body: 'Tata letak yang mengutamakan papan untuk dua sampai empat pemain, dengan giliran yang jelas dan tanpa gangguan antara kamu dan permainan.',
        tint: 'bg-brand/10 text-brand',
    },
    {
        icon: LinkIcon,
        title: 'Ruang privat',
        body: 'Buat ruang, bagikan kode singkat, dan simpan kursi untuk teman yang memang ingin kamu ajak bermain.',
        tint: 'bg-ludo-green/12 text-ludo-green',
    },
    {
        icon: ShieldIcon,
        title: 'Dirancang untuk permainan adil',
        body: 'Dadu dan validasi langkah dipegang server sebagai fondasi mesin pertandingan, bukan kepercayaan sepihak di sisi klien.',
        tint: 'bg-ludo-yellow/15 text-ludo-yellow',
    },
];

type HowItWorksModalProps = {
    open: boolean;
    onClose: () => void;
};

export default function HowItWorksModal({
    open,
    onClose,
}: HowItWorksModalProps) {
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const frame = window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus();
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.cancelAnimationFrame(frame);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return (
        <div
            className="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[3px] sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
            aria-describedby="how-it-works-subtitle"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="animate-modal-enter border-line relative max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto rounded-[26px] border bg-white p-5 shadow-[0_28px_70px_-20px_rgba(32,43,58,0.34)] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-brand-ink text-[11px] font-semibold tracking-[0.16em]">
                            UNTUK PERTANDINGAN SINGKAT
                        </p>
                        <h2
                            id="how-it-works-title"
                            className="text-ink mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl"
                        >
                            Semua yang kamu butuhkan untuk permainan yang
                            bersih.
                        </h2>
                    </div>

                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup cara bermain"
                        className="border-line text-ink-muted hover:bg-surface-muted hover:text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-white transition"
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                <p
                    id="how-it-works-subtitle"
                    className="text-ink-muted mt-2 text-sm leading-6"
                >
                    Aturan sederhana, bidak yang cerah, dan papan yang tetap
                    jadi bintang.
                </p>

                <div className="mt-5 grid gap-3">
                    {FEATURES.map(({ icon: Icon, title, body, tint }) => (
                        <article
                            key={title}
                            className="border-line/80 bg-canvas/70 flex items-start gap-3.5 rounded-2xl border p-4"
                        >
                            <span
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tint}`}
                            >
                                <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h3 className="text-ink text-sm font-semibold sm:text-base">
                                    {title}
                                </h3>
                                <p className="text-ink-muted mt-1 text-xs leading-5 sm:text-sm sm:leading-6">
                                    {body}
                                </p>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold transition"
                    >
                        Tutup
                    </button>
                    <Link
                        href={route('play')}
                        onClick={onClose}
                        className="bg-brand hover:bg-brand-dark inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.75)] transition active:scale-[0.99]"
                    >
                        <DiceIcon className="h-4 w-4" />
                        Main sekarang
                        <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
