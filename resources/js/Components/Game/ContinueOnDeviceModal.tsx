import {
    CheckIcon,
    CloseIcon,
    DeviceHandoffIcon,
    LinkIcon,
    RefreshIcon,
} from '@/Components/Game/Icons';
import { copyText } from '@/lib/clipboard';
import { useModalViewport } from '@/lib/useModalViewport';
import { useHttp } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
    open: boolean;
    roomCode: string;
    onClose: () => void;
};

type HandoffResponse = {
    pairing_code: string;
    expires_in: number;
    continue_url: string;
};

type Pairing = {
    code: string;
    url: string;
    expiresAt: number;
};

type CopyState = 'idle' | 'copied' | 'error';

function formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Lets a seated player continue the same seat on another device. The server
 * issues a short-lived six digit pairing code; the other device opens the
 * room's continue link and types the code. This device keeps playing too.
 */
export default function ContinueOnDeviceModal({
    open,
    roomCode,
    onClose,
}: Props) {
    const overlayStyle = useModalViewport(open);
    const panelRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const handoff = useHttp<Record<string, never>, HandoffResponse>({});
    const [pairing, setPairing] = useState<Pairing | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const canShare =
        typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const requestCode = useCallback(async () => {
        setError(null);
        setCopyState('idle');

        try {
            const csrf =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            const data = await handoff.post(
                route('rooms.handoff.store', { code: roomCode }),
                { headers: { 'X-CSRF-TOKEN': csrf } },
            );

            if (!data?.pairing_code) {
                throw new Error('Pairing code missing');
            }

            setNow(Date.now());
            setPairing({
                code: data.pairing_code,
                url:
                    data.continue_url ||
                    route('rooms.continue', { code: roomCode }),
                expiresAt: Date.now() + data.expires_in * 1000,
            });
        } catch {
            setPairing(null);
            setError('Kode gagal dibuat. Periksa koneksi lalu coba lagi.');
        }
        // `handoff` changes identity on every render; the request only depends
        // on the room code.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomCode]);

    useEffect(() => {
        if (!open) {
            setPairing(null);
            setError(null);
            setCopyState('idle');

            return;
        }

        openerRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        void requestCode();

        const focusTimeout = window.setTimeout(() => {
            panelRef.current?.focus({ preventScroll: true });
        }, 40);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.clearTimeout(focusTimeout);
            window.removeEventListener('keydown', onKeyDown);

            const opener = openerRef.current;
            openerRef.current = null;
            if (opener && document.contains(opener)) {
                opener.focus();
            }
        };
    }, [open, requestCode]);

    useEffect(() => {
        if (!open || !pairing) {
            return;
        }

        const interval = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(interval);
    }, [open, pairing]);

    if (!open) {
        return null;
    }

    const remainingMs = pairing ? pairing.expiresAt - now : 0;
    const expired = pairing !== null && remainingMs <= 0;
    const loading = handoff.processing && !pairing;
    const continueUrl =
        pairing?.url ?? route('rooms.continue', { code: roomCode });

    const handleCopy = async () => {
        const copied = await copyText(continueUrl);
        setCopyState(copied ? 'copied' : 'error');
        window.setTimeout(() => setCopyState('idle'), 1800);
    };

    const handleShare = async () => {
        try {
            await navigator.share({
                title: `Lanjutkan ruang ${roomCode}`,
                text: `Buka tautan ini untuk melanjutkan permainan di ruang ${roomCode}.`,
                url: continueUrl,
            });
        } catch {
            // The share sheet was dismissed; nothing to do.
        }
    };

    return (
        <div
            className="modal-overlay bg-ink/20"
            style={overlayStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="continue-device-title"
            aria-describedby="continue-device-description"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className="modal-panel modal-bezel animate-modal-enter max-w-[min(100%,26rem)] outline-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="modal-bezel-card">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="bg-brand/10 text-brand grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                                <DeviceHandoffIcon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h2
                                    id="continue-device-title"
                                    className="text-ink text-base font-semibold"
                                >
                                    Lanjutkan di perangkat lain
                                </h2>
                                <p
                                    id="continue-device-description"
                                    className="text-ink-muted mt-1 text-xs leading-relaxed"
                                >
                                    Pakai kursi yang sama di HP atau tablet.
                                    Perangkat ini tetap bisa dipakai bermain.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Tutup"
                            className="btn btn-quiet btn-sm btn-icon shrink-0"
                        >
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <ol className="mt-4 space-y-4">
                        <li>
                            <p className="text-ink text-xs font-semibold">
                                1. Buka tautan ini di perangkat lain
                            </p>
                            <p className="border-line bg-canvas text-ink mt-1.5 rounded-xl border px-3 py-2.5 font-mono text-xs leading-relaxed break-all select-all">
                                {continueUrl}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="btn btn-secondary min-h-11 min-w-[8rem] flex-1 gap-1.5"
                                >
                                    {copyState === 'copied' ? (
                                        <>
                                            <CheckIcon className="h-4 w-4" />
                                            Tautan tersalin
                                        </>
                                    ) : (
                                        <>
                                            <LinkIcon className="h-4 w-4" />
                                            {copyState === 'error'
                                                ? 'Gagal menyalin'
                                                : 'Salin tautan'}
                                        </>
                                    )}
                                </button>
                                {canShare && (
                                    <button
                                        type="button"
                                        onClick={handleShare}
                                        className="btn btn-secondary min-h-11 min-w-[8rem] flex-1"
                                    >
                                        Bagikan
                                    </button>
                                )}
                            </div>
                        </li>

                        <li>
                            <p className="text-ink text-xs font-semibold">
                                2. Masukkan kode pairing ini
                            </p>
                            <div
                                className="border-line bg-canvas mt-1.5 rounded-2xl border px-3 py-3 text-center"
                                aria-live="polite"
                            >
                                {loading ? (
                                    <div
                                        aria-label="Membuat kode"
                                        className="bg-line/80 mx-auto h-[clamp(2.25rem,11vw,3rem)] w-[min(100%,12rem)] animate-pulse rounded-xl"
                                    />
                                ) : pairing ? (
                                    <>
                                        <p
                                            className={`font-mono text-[clamp(2rem,11vw,2.75rem)] leading-none font-bold tracking-[0.18em] tabular-nums ${
                                                expired
                                                    ? 'text-ink-muted line-through'
                                                    : 'text-ink'
                                            }`}
                                            aria-label={`Kode pairing ${pairing.code.split('').join(' ')}`}
                                        >
                                            {pairing.code.slice(0, 3)}
                                            <span className="text-ink-muted/40 px-1">
                                                ·
                                            </span>
                                            {pairing.code.slice(3)}
                                        </p>
                                        <p
                                            className={`mt-2 text-xs font-semibold ${
                                                expired
                                                    ? 'text-danger'
                                                    : 'text-ink-muted'
                                            }`}
                                        >
                                            {expired
                                                ? 'Kode kedaluwarsa. Buat kode baru.'
                                                : `Berlaku ${formatRemaining(remainingMs)} · sekali pakai`}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-ink-muted text-xs">
                                        Kode belum tersedia.
                                    </p>
                                )}
                            </div>
                            {error && (
                                <p
                                    role="alert"
                                    className="bg-danger/10 text-danger mt-2 rounded-xl px-3 py-2 text-xs leading-relaxed font-semibold"
                                >
                                    {error}
                                </p>
                            )}
                        </li>
                    </ol>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary min-h-11 min-w-[6.5rem] flex-1"
                        >
                            Tutup
                        </button>
                        <button
                            type="button"
                            disabled={handoff.processing}
                            aria-busy={handoff.processing}
                            onClick={() => void requestCode()}
                            className="btn btn-primary min-h-11 min-w-[6.5rem] flex-1 gap-1.5"
                        >
                            {handoff.processing ? (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                    />
                                    Membuat…
                                </>
                            ) : (
                                <>
                                    <RefreshIcon className="h-4 w-4" />
                                    Buat kode baru
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
