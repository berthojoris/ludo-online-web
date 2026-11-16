import { CloseIcon } from '@/Components/Game/Icons';
import { useModalViewport } from '@/lib/useModalViewport';
import { ReactNode, useCallback, useEffect, useRef } from 'react';

type Props = {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onCancel: () => void;
    onConfirm: () => void;
};

/**
 * Flat UI confirmation used when a player tries to leave a live room or match.
 * Closing (Escape, backdrop, X, or "Lanjut main") keeps the player on the board.
 */
export default function ConfirmLeaveModal({
    open,
    title,
    description,
    confirmLabel = 'Ya, keluar',
    cancelLabel = 'Lanjut main',
    onCancel,
    onConfirm,
}: Props) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const onCancelRef = useRef(onCancel);
    onCancelRef.current = onCancel;
    const overlayStyle = useModalViewport(open);

    useEffect(() => {
        if (!open) {
            return;
        }

        openerRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const focusTimeout = window.setTimeout(
            () => cancelRef.current?.focus(),
            40,
        );

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancelRef.current();
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
            className="modal-overlay bg-ink/40 backdrop-blur-[3px]"
            style={overlayStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-leave-title"
            aria-describedby="confirm-leave-description"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div
                className="modal-panel animate-modal-enter border-line max-w-sm overflow-y-auto overscroll-contain rounded-[24px] border bg-white p-5 shadow-[0_24px_64px_-16px_rgba(32,43,58,0.3)]"
                onClick={stopPropagation}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
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
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Tutup konfirmasi"
                        className="btn btn-quiet btn-sm btn-icon shrink-0"
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-5 flex items-center gap-2">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="btn btn-secondary flex-1"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="btn btn-danger flex-1"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
