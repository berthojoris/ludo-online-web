import DangerButton from '@/Components/DangerButton';
import {
    CloseIcon,
    EyeIcon,
    EyeOffIcon,
    LockIcon,
} from '@/Components/Game/Icons';
import Modal from '@/Components/Modal';
import { hasCoarsePointer } from '@/lib/useModalViewport';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useRef, useState } from 'react';

export default function DeleteUserForm({
    className = '',
}: {
    className?: string;
}) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setShowPassword(false);
        setConfirmingUserDeletion(true);
    };

    const deleteUser: FormEventHandler = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        if (processing) {
            return;
        }

        setConfirmingUserDeletion(false);
        setShowPassword(false);

        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-6 ${className}`}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">
                    Hapus akun
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    Setelah akun dihapus, semua sumber daya dan datanya akan
                    dihapus permanen. Sebelum menghapus akun, unduh dulu data
                    atau informasi yang ingin kamu simpan.
                </p>
            </header>

            <DangerButton onClick={confirmUserDeletion}>
                Hapus akun
            </DangerButton>

            <Modal
                show={confirmingUserDeletion}
                maxWidth="md"
                closeable={!processing}
                ariaLabelledBy="delete-account-title"
                ariaDescribedBy="delete-account-description"
                initialFocus={
                    hasCoarsePointer() ? cancelButtonRef : passwordInput
                }
                onClose={closeModal}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="bg-danger/10 text-danger grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                            <LockIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2
                                id="delete-account-title"
                                className="text-ink text-base font-semibold"
                            >
                                Yakin ingin menghapus akun kamu?
                            </h2>
                            <p
                                id="delete-account-description"
                                className="text-ink-muted mt-1 text-xs leading-relaxed"
                            >
                                Setelah akun dihapus, semua sumber daya dan
                                datanya akan dihapus permanen. Masukkan kata
                                sandi untuk memastikan kamu benar-benar ingin
                                menghapus akun ini secara permanen.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={processing}
                        onClick={closeModal}
                        aria-label="Tutup dialog"
                        className="btn btn-quiet btn-sm btn-icon shrink-0"
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={deleteUser}>
                    <label
                        htmlFor="delete-account-password"
                        className="text-ink mt-4 block text-xs font-semibold"
                    >
                        Kata sandi
                    </label>
                    <div className="relative mt-1.5">
                        <input
                            id="delete-account-password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            autoComplete="current-password"
                            enterKeyHint="done"
                            disabled={processing}
                            onChange={(e) => {
                                setData('password', e.target.value);
                                if (errors.password) {
                                    clearErrors('password');
                                }
                            }}
                            placeholder="Kata sandi"
                            aria-invalid={errors.password ? true : undefined}
                            aria-describedby={
                                errors.password
                                    ? 'delete-account-password-error'
                                    : undefined
                            }
                            className={`text-ink focus-visible:ring-brand/60 h-11 w-full rounded-xl border bg-white pr-12 pl-3 text-base transition outline-none focus-visible:ring-2 disabled:opacity-60 ${
                                errors.password
                                    ? 'border-danger'
                                    : 'border-line'
                            }`}
                        />
                        <button
                            type="button"
                            disabled={processing}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                                setShowPassword((visible) => !visible)
                            }
                            aria-label={
                                showPassword
                                    ? 'Sembunyikan kata sandi'
                                    : 'Tampilkan kata sandi'
                            }
                            aria-pressed={showPassword}
                            aria-controls="delete-account-password"
                            className="text-ink-muted hover:text-ink focus-visible:ring-brand/60 absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl transition outline-none focus-visible:ring-2 disabled:opacity-50"
                        >
                            {showPassword ? (
                                <EyeOffIcon className="h-5 w-5" />
                            ) : (
                                <EyeIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>

                    {errors.password && (
                        <p
                            id="delete-account-password-error"
                            role="alert"
                            className="text-danger mt-1.5 text-xs leading-relaxed"
                        >
                            {errors.password}
                        </p>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <button
                            ref={cancelButtonRef}
                            type="button"
                            disabled={processing}
                            onClick={closeModal}
                            className="btn btn-secondary min-w-[6.5rem] flex-1"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={processing || data.password === ''}
                            aria-busy={processing}
                            className="btn btn-danger min-w-[6.5rem] flex-1"
                        >
                            {processing ? (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                    />
                                    Menghapus…
                                </>
                            ) : (
                                'Hapus akun'
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
