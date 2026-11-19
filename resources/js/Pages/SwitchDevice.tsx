import {
    ArrowRightIcon,
    ChevronLeftIcon,
    DeviceHandoffIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import { ARENA_BACKGROUND_IMAGE } from '@/lib/ludo';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

type SwitchDevicePageProps = {
    codeLength?: number;
};

/**
 * Device switch entry point reachable from the home screen. The player types
 * the six digit pairing code shown on the device that is already playing, and
 * the server binds this browser to the very same seat in whichever active room
 * issued the code.
 */
export default function SwitchDevice({
    codeLength = 6,
}: SwitchDevicePageProps) {
    const form = useForm({ pairing_code: '' });
    const pairingError = form.errors.pairing_code;
    const complete = form.data.pairing_code.length === codeLength;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!complete || form.processing) {
            return;
        }

        form.post(route('switch.store'), {
            preserveScroll: true,
            onError: () => form.reset('pairing_code'),
        });
    };

    return (
        <>
            <Head title="Switch perangkat" />

            <div className="bg-canvas relative flex h-screen min-h-0 w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url('${ARENA_BACKGROUND_IMAGE}')`,
                    }}
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-950/15 via-white/30 to-white/65 backdrop-blur-[1.5px]"
                />

                <header className="relative z-20 shrink-0 border-b border-white/60 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
                    <div className="mx-auto flex h-12 max-w-6xl items-center gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:h-14 sm:px-6">
                        <Link
                            href={route('home')}
                            aria-label="Kembali ke beranda"
                            className="btn btn-secondary btn-sm btn-icon shrink-0"
                        >
                            <ChevronLeftIcon className="h-4 w-4" />
                        </Link>
                        <Link
                            href={route('home')}
                            aria-label="Beranda Ludo Arena"
                            className="shrink-0 rounded-lg"
                        >
                            <Logo className="h-7 w-7" withWordmark compact />
                        </Link>
                    </div>
                </header>

                <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center overflow-y-auto px-3 py-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(12px,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:px-6">
                    <div className="animate-modal-enter shadow-card my-auto w-full max-w-md rounded-[24px] border border-white/85 bg-white/95 p-5 backdrop-blur-md sm:p-7">
                        <div className="flex items-center gap-3">
                            <span className="bg-brand/10 text-brand-ink grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                                <DeviceHandoffIcon className="h-5.5 w-5.5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="text-ink text-lg font-semibold tracking-tight sm:text-xl">
                                    Switch ke perangkat ini
                                </h1>
                                <p className="text-ink-muted text-xs sm:text-sm">
                                    Lanjutkan sesi yang sedang berjalan
                                </p>
                            </div>
                        </div>

                        <ol className="text-ink-muted mt-5 space-y-2.5 text-xs leading-relaxed">
                            <li className="flex gap-2.5">
                                <span className="bg-brand/10 text-brand-ink grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold">
                                    1
                                </span>
                                <span>
                                    Di perangkat lama, buka ruang atau
                                    permainan lalu ketuk tombol{' '}
                                    <span className="text-ink font-semibold">
                                        Lanjut di HP
                                    </span>{' '}
                                    (ikon ponsel).
                                </span>
                            </li>
                            <li className="flex gap-2.5">
                                <span className="bg-brand/10 text-brand-ink grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold">
                                    2
                                </span>
                                <span>
                                    Ketik kode pairing {codeLength} angka yang
                                    tampil di perangkat lama ke kolom di bawah.
                                </span>
                            </li>
                        </ol>

                        <form onSubmit={submit} className="mt-5" noValidate>
                            <label
                                htmlFor="pairing-code"
                                className="text-ink block text-xs font-semibold"
                            >
                                Kode pairing
                            </label>
                            <input
                                id="pairing-code"
                                name="pairing_code"
                                value={form.data.pairing_code}
                                onChange={(event) =>
                                    form.setData(
                                        'pairing_code',
                                        event.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, codeLength),
                                    )
                                }
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoComplete="one-time-code"
                                enterKeyHint="go"
                                maxLength={codeLength}
                                placeholder="000000"
                                disabled={form.processing}
                                aria-invalid={pairingError ? true : undefined}
                                aria-describedby={
                                    pairingError
                                        ? 'pairing-code-error'
                                        : undefined
                                }
                                className={`bg-canvas text-ink placeholder:text-ink-muted/35 focus:border-brand focus:ring-brand/10 mt-2 h-15 w-full rounded-2xl border px-4 text-center font-mono text-2xl font-semibold tracking-[0.34em] transition focus:bg-white focus:ring-4 focus:outline-none disabled:opacity-60 sm:h-16 sm:text-3xl ${
                                    pairingError ? 'border-danger' : 'border-line'
                                }`}
                            />

                            <div
                                className="mt-3 grid grid-cols-6 gap-1.5"
                                aria-hidden="true"
                            >
                                {Array.from(
                                    { length: codeLength },
                                    (_, index) => (
                                        <span
                                            key={index}
                                            className={`h-1 rounded-full transition-colors ${
                                                index <
                                                form.data.pairing_code.length
                                                    ? 'bg-brand'
                                                    : 'bg-line'
                                            }`}
                                        />
                                    ),
                                )}
                            </div>

                            {pairingError && (
                                <p
                                    id="pairing-code-error"
                                    role="alert"
                                    className="bg-danger/10 text-danger mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed font-semibold"
                                >
                                    {pairingError}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={!complete || form.processing}
                                aria-busy={form.processing}
                                className="btn btn-primary mt-5 min-h-12 w-full gap-2 rounded-[14px] text-sm"
                            >
                                {form.processing ? (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                                        />
                                        Menghubungkan…
                                    </>
                                ) : (
                                    <>
                                        Lanjutkan
                                        <ArrowRightIcon className="h-4 w-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="text-ink-muted mt-4 text-center text-[11px] leading-relaxed">
                            Belum punya kode? Buka permainan di perangkat lama
                            dan ketuk tombol{' '}
                            <span className="text-ink font-semibold">
                                Lanjut di HP
                            </span>
                            .
                        </p>
                    </div>
                </main>
            </div>
        </>
    );
}
