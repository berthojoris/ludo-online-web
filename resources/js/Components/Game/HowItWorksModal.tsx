import {
    ArrowRightIcon,
    CloseIcon,
    DiceIcon,
    TrophyIcon,
} from '@/Components/Game/Icons';
import {
    Dialog,
    DialogDescription,
    DialogPanel,
    DialogTitle,
    Transition,
    TransitionChild,
} from '@headlessui/react';
import { Link } from '@inertiajs/react';
import { Fragment } from 'react';

const STEPS = [
    {
        title: 'Lempar untuk keluar',
        body: 'Bidak bisa keluar dari markas saat dadu menunjukkan 6. Dapat 6 juga memberi lemparan tambahan.',
    },
    {
        title: 'Pilih bidak yang menyala',
        body: 'Setelah dadu berhenti, bidak yang bisa bergerak akan menyala. Klik untuk maju sesuai mata dadu.',
    },
    {
        title: 'Amankan atau tangkap',
        body: 'Petak bintang tidak bisa ditangkap. Mendarat di bidak lawan di luar petak aman memakannya dan memberi lemparan tambahan.',
    },
    {
        title: 'Masuk ke rumah dengan tepat',
        body: 'Butuh angka dadu yang pas untuk finis. Bawa keempat bidak ke rumah lebih dulu untuk memenangkan pertandingan.',
    },
] as const;

type HowItWorksModalProps = {
    open: boolean;
    onClose: () => void;
    onStart: () => void;
};

export default function HowItWorksModal({
    open,
    onClose,
    onStart,
}: HowItWorksModalProps) {
    return (
        <Transition show={open} as={Fragment}>
            <Dialog
                onClose={onClose}
                aria-labelledby="how-it-works-title"
                className="relative z-50"
            >
                <TransitionChild
                    as={Fragment}
                    enter="duration-200 ease-out"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="duration-150 ease-in"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div
                        aria-hidden="true"
                        className="bg-ink/45 fixed inset-0 backdrop-blur-[3px]"
                    />
                </TransitionChild>

                <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-4">
                    <TransitionChild
                        as={Fragment}
                        enter="duration-200 ease-out"
                        enterFrom="translate-y-2 scale-[0.98] opacity-0"
                        enterTo="translate-y-0 scale-100 opacity-100"
                        leave="duration-150 ease-in"
                        leaveFrom="translate-y-0 scale-100 opacity-100"
                        leaveTo="translate-y-2 scale-[0.98] opacity-0"
                    >
                        <DialogPanel
                            data-testid="how-it-works-panel"
                            className="border-line/80 shadow-board relative my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border bg-white"
                        >
                            <div
                                aria-hidden="true"
                                className="flex h-1 shrink-0"
                            >
                                <span className="bg-ludo-red flex-1" />
                                <span className="bg-ludo-green flex-1" />
                                <span className="bg-ludo-yellow flex-1" />
                                <span className="bg-ludo-blue flex-1" />
                            </div>

                            <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
                                <div className="min-w-0">
                                    <DialogTitle
                                        id="how-it-works-title"
                                        className="text-ink text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-2xl"
                                    >
                                        Cara bermain
                                    </DialogTitle>
                                    <DialogDescription className="text-ink-muted mt-1 text-sm leading-6">
                                        Empat langkah dari markas ke garis
                                        akhir.
                                    </DialogDescription>
                                </div>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Tutup cara bermain"
                                    className="border-line text-ink-muted hover:bg-surface-muted hover:text-ink grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white transition"
                                >
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                            </header>

                            <div className="border-line/70 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t px-5 py-5 sm:px-6">
                                <div className="grid gap-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] md:gap-6">
                                    <aside className="bg-ink order-2 flex h-full flex-col rounded-2xl px-4 py-4 text-white md:order-1">
                                        <div className="flex items-center gap-2">
                                            <TrophyIcon className="text-ludo-yellow h-4 w-4 shrink-0" />
                                            <p className="text-[10px] font-semibold tracking-[0.16em] text-white/65 uppercase">
                                                Tujuan
                                            </p>
                                        </div>
                                        <p className="mt-2 text-[15px] leading-6 font-semibold">
                                            Bawa keempat bidak ke rumah sebelum
                                            pemain lain.
                                        </p>

                                        <dl className="mt-4 border-y border-white/10">
                                            <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
                                                <dt className="text-xs text-white/65">
                                                    Pemain
                                                </dt>
                                                <dd className="text-xs font-semibold">
                                                    2–4 orang
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2.5">
                                                <dt className="text-xs text-white/65">
                                                    Bidak
                                                </dt>
                                                <dd className="text-xs font-semibold">
                                                    4 per pemain
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 py-2.5">
                                                <dt className="text-xs text-white/65">
                                                    Batas giliran
                                                </dt>
                                                <dd className="text-xs font-semibold">
                                                    15 detik
                                                </dd>
                                            </div>
                                        </dl>

                                        <div className="mt-auto pt-5">
                                            <p className="text-[10px] font-semibold tracking-[0.16em] text-white/65 uppercase">
                                                Aturan khusus
                                            </p>
                                            <p className="mt-1.5 text-[11px] leading-5 text-white/80">
                                                Tiga kali enam berturut-turut
                                                membuat giliranmu hangus dan
                                                berpindah ke pemain berikutnya.
                                            </p>
                                        </div>
                                    </aside>

                                    <section
                                        aria-labelledby="how-it-works-steps"
                                        className="order-1 md:order-2"
                                    >
                                        <h3
                                            id="how-it-works-steps"
                                            className="text-ink-muted text-[11px] font-semibold tracking-[0.14em] uppercase"
                                        >
                                            Alur giliran
                                        </h3>

                                        <ol className="border-line/70 divide-line/70 mt-2.5 divide-y border-y">
                                            {STEPS.map((step, index) => (
                                                <li
                                                    key={step.title}
                                                    className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3"
                                                >
                                                    <span className="border-line text-brand-ink grid h-8 w-8 place-items-center rounded-full border bg-white text-[11px] font-bold tabular-nums shadow-[0_1px_2px_rgb(32_43_58_/_5%)]">
                                                        {String(
                                                            index + 1,
                                                        ).padStart(2, '0')}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <h4 className="text-ink text-sm font-semibold">
                                                            {step.title}
                                                        </h4>
                                                        <p className="text-ink-muted mt-0.5 text-[13px] leading-5">
                                                            {step.body}
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ol>
                                    </section>
                                </div>
                            </div>

                            <footer className="border-line/70 flex shrink-0 flex-col gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold transition"
                                >
                                    Tutup
                                </button>
                                <Link
                                    href={route('play')}
                                    onClick={onStart}
                                    className="bg-brand hover:bg-brand-dark inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.75)] transition active:scale-[0.99]"
                                >
                                    <DiceIcon className="h-4 w-4" />
                                    Main sekarang
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            </footer>
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </Transition>
    );
}
