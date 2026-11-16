import { CloseIcon, LockIcon } from '@/Components/Game/Icons';
import { hasCoarsePointer, useModalViewport } from '@/lib/useModalViewport';
import { FormEvent, useEffect, useRef, useState } from 'react';

type Props = {
    open: boolean;
    processing?: boolean;
    error?: string | null;
    onCancel: () => void;
    onSubmit: (password: string) => void;
};

/**
 * Static access check shown before a visitor can create a room. The submitted
 * password is verified on the server, so the value is never shipped to the
 * browser bundle.
 */
export default function CreateRoomPasswordModal({
    open,
    processing = false,
    error = null,
    onCancel,
    onSubmit,
}: Props) {
    const [password, setPassword] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const overlayStyle = useModalViewport(open);
    const onCancelRef = useRef(onCancel);
    const processingRef = useRef(processing);
    onCancelRef.current = onCancel;
    processingRef.current = processing;

    useEffect(() => {
        if (!open) {
            return;
        }

        setPassword('');

        const focusTimeout = window.setTimeout(() => {
            if (hasCoarsePointer()) {
                panelRef.current?.focus({ preventScroll: true });
            } else {
                inputRef.current?.focus();
            }
        }, 40);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !processingRef.current) {
                event.preventDefault();
                onCancelRef.current();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.clearTimeout(focusTimeout);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    if (!open) {
        return null;
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (processing || password === '') {
            return;
        }

        onSubmit(password);
    };

    return (
        <div
            className="modal-overlay bg-ink/40 backdrop-blur-[3px]"
            style={overlayStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-room-password-title"
            aria-describedby="create-room-password-description"
            onClick={(event) => {
                if (event.target === event.currentTarget && !processing) {
                    onCancel();
                }
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className="modal-panel animate-modal-enter border-line max-w-sm overflow-y-auto overscroll-contain rounded-[24px] border bg-white p-5 shadow-[0_24px_64px_-16px_rgba(32,43,58,0.3)] outline-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="bg-brand/10 text-brand grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                            <LockIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2
                                id="create-room-password-title"
                                className="text-ink text-base font-semibold"
                            >
                                Buat ruang baru?
                            </h2>
                            <p
                                id="create-room-password-description"
                                className="text-ink-muted mt-1 text-xs leading-relaxed"
                            >
                                Pembuatan ruang dibatasi. Masukkan kata sandi
                                akses untuk melanjutkan.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={onCancel}
                        aria-label="Tutup konfirmasi"
                        className="btn btn-quiet btn-sm btn-icon shrink-0"
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <label
                        htmlFor="create-room-password"
                        className="text-ink mt-4 block text-xs font-semibold"
                    >
                        Kata sandi
                    </label>
                    <input
                        ref={inputRef}
                        id="create-room-password"
                        type="password"
                        name="password"
                        value={password}
                        autoComplete="off"
                        enterKeyHint="done"
                        disabled={processing}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={
                            error ? 'create-room-password-error' : undefined
                        }
                        className={`text-ink focus-visible:ring-brand/60 mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-base transition outline-none focus-visible:ring-2 disabled:opacity-60 ${
                            error ? 'border-danger' : 'border-line'
                        }`}
                    />
                    {error && (
                        <p
                            id="create-room-password-error"
                            role="alert"
                            className="text-danger mt-1.5 text-xs leading-relaxed"
                        >
                            {error}
                        </p>
                    )}

                    <div className="mt-5 flex items-center gap-2">
                        <button
                            type="button"
                            disabled={processing}
                            onClick={onCancel}
                            className="btn btn-secondary flex-1"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={processing || password === ''}
                            className="btn btn-primary flex-1"
                        >
                            {processing ? 'Memeriksa…' : 'Buat ruang'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
