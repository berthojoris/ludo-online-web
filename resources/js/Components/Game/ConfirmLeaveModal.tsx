import { CloseIcon, LogoutIcon } from '@/Components/Game/Icons';
import { hasCoarsePointer, useModalViewport } from '@/lib/useModalViewport';
import { ReactNode, useCallback, useEffect, useRef } from 'react';

type Props = {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    processing?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

/**
 * Flat UI confirmation used when a player tries to leave a live room or match.
 * Closing (Escape, backdrop, X, or "Lanjut main") keeps the player on the board.
 * While `processing` the whole dialog stays open and locked until the server
 * answers the leave request.
 */
export default function ConfirmLeaveModal({
    open,
    title,
    description,
    confirmLabel = 'Ya, keluar',
    cancelLabel = 'Lanjut main',
    processing = false,
    onCancel,
    onConfirm,
}: Props) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const onCancelRef = useRef(onCancel);
    onCancelRef.current = onCancel;
    const processingRef = useRef(processing);
    processingRef.current = processing;
    const overlayStyle = useModalViewport(open);

    useEffect(() => {
        if (!open) {
            return;
        }

        openerRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const focusTimeout = window.setTimeout(() => {
            if (hasCoarsePointer()) {
                panelRef.current?.focus({ preventScroll: true });
            } else {
                cancelRef.current?.focus();
            }
        }, 40);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();

                if (!processingRef.current) {
                    onCancelRef.current();
                }
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
    }, [open]);

    const stopPropagation = useCallback(
        (event: { stopPropagation: () => void }) => {
            event.stopPropagation();
        },
        [],
    );

    if (!open) {
        return null;
    }

    return (
        <div
            className="modal-overlay bg-ink/20"
            style={overlayStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-leave-title"
            aria-describedby="confirm-leave-description"
            onClick={(event) => {
                if (event.target === event.currentTarget && !processing) {
                    onCancel();
                }
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className="modal-panel modal-bezel animate-modal-enter max-w-[min(100%,25rem)] outline-none"
                onClick={stopPropagation}
            >
                <div className="modal-bezel-card">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="bg-danger/10 text-danger grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                                <LogoutIcon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h2
                                    id="confirm-leave-title"
                                    className="text-ink text-base font-semibold"
                                >
                                    {title}
                                </h2>
                                <p
                                    id="confirm-leave-description"
                                    className="text-ink-muted mt-1 text-xs leading-relaxed"
                                >
                                    {description}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={processing}
                            aria-label="Tutup konfirmasi"
                            className="btn btn-quiet btn-sm btn-icon shrink-0"
                        >
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <button
                            ref={cancelRef}
                            type="button"
                            onClick={onCancel}
                            disabled={processing}
                            className="btn btn-secondary min-w-[6.5rem] flex-1"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={processing}
                            aria-busy={processing}
                            className="btn btn-danger min-w-[6.5rem] flex-1"
                        >
                            {processing && (
                                <span
                                    aria-hidden="true"
                                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                />
                            )}
                            {processing ? 'Keluar…' : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
