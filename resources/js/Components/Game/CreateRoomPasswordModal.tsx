import {
    CloseIcon,
    EyeIcon,
    EyeOffIcon,
    LockIcon,
} from '@/Components/Game/Icons';
import { hasCoarsePointer, useModalViewport } from '@/lib/useModalViewport';
import { FormEvent, useEffect, useRef, useState } from 'react';

type Props = {
    open: boolean;
    processing?: boolean;
    error?: string | null;
    passwordRequired?: boolean;
    onCancel: () => void;
    onSubmit: (password: string, vsComputer: boolean) => void;
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
    passwordRequired = true,
    onCancel,
    onSubmit,
}: Props) {
    const [password, setPassword] = useState('');
    const [vsComputer, setVsComputer] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const overlayStyle = useModalViewport(open);
    const onCancelRef = useRef(onCancel);
    const processingRef = useRef(processing);
    onCancelRef.current = onCancel;
    processingRef.current = processing;

    useEffect(() => {
        if (!open) {
            return;
        }

        openerRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        setPassword('');
        setVsComputer(false);
        setShowPassword(false);

        const focusTimeout = window.setTimeout(() => {
            if (hasCoarsePointer() || !passwordRequired) {
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

            const opener = openerRef.current;
            openerRef.current = null;
            if (opener && document.contains(opener)) {
                opener.focus();
            }
        };
    }, [open, passwordRequired]);

    if (!open) {
        return null;
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (processing || (passwordRequired && password === '')) {
            return;
        }

        onSubmit(password, vsComputer);
    };

    return (
        <div
            className="modal-overlay bg-ink/20"
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
                className="modal-panel modal-bezel animate-modal-enter max-w-[min(100%,25rem)] outline-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="modal-bezel-card">
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
                                    {passwordRequired
                                        ? 'Masukkan kata sandi akses dan pilih lawan.'
                                        : 'Pilih lawan untuk ruang baru.'}
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
                        <fieldset className="mt-4" disabled={processing}>
                            <legend className="text-ink text-xs font-semibold">
                                Lawan
                            </legend>
                            <div className="segmented mt-1.5 grid grid-cols-2">
                                <button
                                    type="button"
                                    className="segmented-item min-h-11 px-2 text-xs"
                                    aria-pressed={!vsComputer}
                                    onClick={() => setVsComputer(false)}
                                >
                                    MANUSIA
                                </button>
                                <button
                                    type="button"
                                    className="segmented-item min-h-11 px-2 text-xs"
                                    aria-pressed={vsComputer}
                                    onClick={() => setVsComputer(true)}
                                >
                                    VS COMPUTER
                                </button>
                            </div>
                            {vsComputer && (
                                <p className="text-ink-muted mt-1 text-xs">
                                    Level Computer: MEDIUM
                                </p>
                            )}
                        </fieldset>
                        {passwordRequired && (
                            <>
                                <label
                                    htmlFor="create-room-password"
                                    className="text-ink mt-4 block text-xs font-semibold"
                                >
                                    Kata sandi
                                </label>
                                <div className="relative mt-1.5">
                                    <input
                                        ref={inputRef}
                                        id="create-room-password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={password}
                                        autoComplete="off"
                                        enterKeyHint="done"
                                        disabled={processing}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        aria-invalid={error ? true : undefined}
                                        aria-describedby={
                                            error
                                                ? 'create-room-password-error'
                                                : undefined
                                        }
                                        className={`text-ink focus-visible:ring-brand/60 h-11 w-full rounded-xl border bg-white pr-12 pl-3 text-base transition outline-none focus-visible:ring-2 disabled:opacity-60 ${
                                            error
                                                ? 'border-danger'
                                                : 'border-line'
                                        }`}
                                    />
                                    <button
                                        type="button"
                                        disabled={processing}
                                        onMouseDown={(event) =>
                                            event.preventDefault()
                                        }
                                        onClick={() =>
                                            setShowPassword(
                                                (visible) => !visible,
                                            )
                                        }
                                        aria-label={
                                            showPassword
                                                ? 'Sembunyikan kata sandi'
                                                : 'Tampilkan kata sandi'
                                        }
                                        aria-pressed={showPassword}
                                        aria-controls="create-room-password"
                                        title={
                                            showPassword
                                                ? 'Sembunyikan kata sandi'
                                                : 'Tampilkan kata sandi'
                                        }
                                        className="text-ink-muted hover:text-ink focus-visible:ring-brand/60 absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl transition outline-none focus-visible:ring-2 disabled:opacity-50"
                                    >
                                        {showPassword ? (
                                            <EyeOffIcon className="h-5 w-5" />
                                        ) : (
                                            <EyeIcon className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                                {error && (
                                    <p
                                        id="create-room-password-error"
                                        role="alert"
                                        className="text-danger mt-1.5 text-xs leading-relaxed"
                                    >
                                        {error}
                                    </p>
                                )}
                            </>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={processing}
                                onClick={onCancel}
                                className="btn btn-secondary min-w-[6.5rem] flex-1"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={
                                    processing ||
                                    (passwordRequired && password === '')
                                }
                                aria-busy={processing}
                                className="btn btn-primary min-w-[6.5rem] flex-1"
                            >
                                {processing ? 'Memeriksa…' : 'Buat ruang'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
