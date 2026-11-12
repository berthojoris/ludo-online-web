import {
    ArrowRightIcon,
    CheckIcon,
    ChevronLeftIcon,
    CopyIcon,
    HashIcon,
    InfoIcon,
    LinkIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import { User } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type CopyState = 'idle' | 'code' | 'link' | 'error';

type Seat =
    | {
          kind: 'you';
          name: string;
          label: string;
          ready: boolean;
      }
    | {
          kind: 'host';
          name: string;
          label: string;
      }
    | {
          kind: 'empty';
          name: string;
          label: string;
      };

function generateRoomCode(): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.getRandomValues === 'function'
    ) {
        const values = new Uint32Array(6);
        crypto.getRandomValues(values);

        return Array.from(
            values,
            (value) => CODE_ALPHABET[value % CODE_ALPHABET.length],
        ).join('');
    }

    return Array.from(
        { length: 6 },
        () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
}

function normalizeCode(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
}

async function copyText(value: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);

            return true;
        }

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);

        return copied;
    } catch {
        return false;
    }
}

export default function Room() {
    const page = usePage();
    const { auth } = page.props as unknown as {
        auth?: { user: User | null };
    };
    const { url } = page;
    const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const params = new URLSearchParams(query);
    const joinRequested = params.get('join') === '1';
    const codeFromUrl = normalizeCode(params.get('code') ?? '');

    const playerName = auth?.user?.name?.split(' ')[0] ?? 'Tamu';
    const [code, setCode] = useState(() => codeFromUrl || generateRoomCode());
    const [joinCode, setJoinCode] = useState(codeFromUrl);
    const [showJoinForm, setShowJoinForm] = useState(
        joinRequested && !codeFromUrl,
    );
    const [isGuest] = useState(joinRequested);
    const [ready, setReady] = useState(false);
    const [copyState, setCopyState] = useState<CopyState>('idle');

    const shareLink =
        typeof window !== 'undefined'
            ? `${window.location.origin}/room?code=${code}`
            : `/room?code=${code}`;

    const copy = async (value: string, target: 'code' | 'link') => {
        const copied = await copyText(value);
        setCopyState(copied ? target : 'error');
        window.setTimeout(() => setCopyState('idle'), 1800);
    };

    const handleJoin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (joinCode.length !== 6) {
            return;
        }

        setCode(joinCode);
        setShowJoinForm(false);
    };

    const seats: Seat[] = isGuest
        ? [
              {
                  kind: 'host',
                  name: 'Tuan rumah',
                  label: 'Tuan rumah',
              },
              {
                  kind: 'you',
                  name: playerName,
                  label: 'Kamu',
                  ready,
              },
              {
                  kind: 'empty',
                  name: 'Kursi kosong',
                  label: 'Menunggu',
              },
              {
                  kind: 'empty',
                  name: 'Kursi kosong',
                  label: 'Menunggu',
              },
          ]
        : [
              {
                  kind: 'you',
                  name: playerName,
                  label: 'Tuan rumah',
                  ready,
              },
              {
                  kind: 'empty',
                  name: 'Kursi kosong',
                  label: 'Menunggu',
              },
              {
                  kind: 'empty',
                  name: 'Kursi kosong',
                  label: 'Menunggu',
              },
              {
                  kind: 'empty',
                  name: 'Kursi kosong',
                  label: 'Menunggu',
              },
          ];

    return (
        <>
            <Head title="Ruang privat" />

            <div className="relative min-h-screen overflow-x-clip">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden"
                >
                    <div className="bg-brand/10 absolute top-16 -left-24 h-72 w-72 rounded-full blur-3xl" />
                    <div className="bg-ludo-yellow/10 absolute top-24 right-0 h-80 w-80 rounded-full blur-3xl" />
                    <div className="dot-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_78%)] opacity-30" />
                </div>

                <header className="border-line/60 bg-canvas/85 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <Link
                                href={route('home')}
                                aria-label="Kembali ke beranda"
                                className="border-line text-ink-muted hover:text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-white shadow-sm transition"
                            >
                                <ChevronLeftIcon className="h-4.5 w-4.5" />
                            </Link>
                            <Link href={route('home')} className="rounded-lg">
                                <Logo
                                    className="h-8 w-8"
                                    withWordmark
                                    compact
                                />
                            </Link>
                            <span className="border-line text-ink-muted hidden rounded-full border bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase sm:inline-flex">
                                Ruang
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {showJoinForm ? (
                                <span className="border-line text-ink-muted inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-[11px] font-semibold">
                                    <InfoIcon className="h-3.5 w-3.5" />
                                    Pratinjau UI
                                </span>
                            ) : (
                                <span className="border-warning/20 bg-warning/10 text-warning-ink inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold">
                                    <span className="bg-warning h-1.5 w-1.5 rounded-full" />
                                    Menunggu pemain
                                </span>
                            )}
                            <Link
                                href={route('home')}
                                className="text-ink-muted hover:text-ink hidden rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-white sm:inline-flex"
                            >
                                Keluar
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
                    {showJoinForm ? (
                        <div className="animate-fade-up mx-auto max-w-md">
                            <div className="border-line/80 shadow-card rounded-[28px] border bg-white p-6 sm:p-8">
                                <span className="bg-brand/10 text-brand-ink grid h-12 w-12 place-items-center rounded-2xl">
                                    <HashIcon className="h-6 w-6" />
                                </span>
                                <h1 className="text-ink mt-4 text-2xl font-semibold tracking-tight">
                                    Gabung ke ruang
                                </h1>
                                <p className="text-ink-muted mt-2 text-sm leading-6">
                                    Masukkan kode enam karakter yang dibagikan
                                    tuan rumah. Tidak perlu akun untuk
                                    melihat-lihat.
                                </p>

                                <form onSubmit={handleJoin} className="mt-6">
                                    <label
                                        htmlFor="room-code"
                                        className="text-ink text-xs font-semibold"
                                    >
                                        Kode ruang
                                    </label>
                                    <input
                                        id="room-code"
                                        value={joinCode}
                                        onChange={(event) =>
                                            setJoinCode(
                                                normalizeCode(
                                                    event.target.value,
                                                ),
                                            )
                                        }
                                        inputMode="text"
                                        autoCapitalize="characters"
                                        autoComplete="off"
                                        spellCheck={false}
                                        maxLength={6}
                                        placeholder="ABC123"
                                        aria-label="Kode ruang enam karakter"
                                        className="border-line bg-surface-muted/60 text-ink placeholder:text-ink-muted/40 focus:border-brand focus:ring-brand/10 mt-2 h-16 w-full rounded-2xl border px-4 text-center text-2xl font-semibold tracking-[0.32em] uppercase transition focus:bg-white focus:ring-4 focus:outline-none"
                                    />

                                    <button
                                        type="submit"
                                        disabled={joinCode.length !== 6}
                                        className="bg-brand hover:bg-brand-dark disabled:bg-surface-muted disabled:text-ink-muted mt-3 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.8)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:shadow-none"
                                    >
                                        Gabung ruang
                                        <ArrowRightIcon className="h-4 w-4" />
                                    </button>
                                </form>

                                <p className="bg-surface-muted text-ink-muted mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px] leading-5">
                                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                    Bergabung ke ruang masih berupa pratinjau
                                    UI. Sinkronisasi ruang langsung hadir
                                    bersama backend pencarian lawan.
                                </p>

                                <Link
                                    href={route('home')}
                                    className="text-ink-muted hover:text-ink mt-5 inline-flex items-center gap-1.5 text-xs font-semibold transition"
                                >
                                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                                    Kembali ke beranda
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-up">
                            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-brand-ink text-[11px] font-semibold tracking-[0.16em]">
                                        RUANG PRIVAT
                                    </p>
                                    <h1 className="text-ink mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                                        {isGuest
                                            ? 'Kamu sudah bergabung ke ruang.'
                                            : 'Meja kamu sudah siap.'}
                                    </h1>
                                    <p className="text-ink-muted mt-2 max-w-xl text-sm leading-6">
                                        Bagikan kode, tunggu temanmu, dan mulai
                                        saat semua sudah duduk. Pratinjau ini
                                        menyimpan lobi di sisi klien.
                                    </p>
                                </div>
                                <span className="border-line text-ink-muted inline-flex w-fit items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-semibold shadow-sm">
                                    <UsersIcon className="h-4 w-4" />1 dari 4
                                    duduk
                                </span>
                            </div>

                            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                                <div className="space-y-4">
                                    <section className="border-brand/15 bg-brand/[0.04] rounded-[24px] border p-5 sm:p-6">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-brand-ink text-[10px] font-semibold tracking-[0.18em]">
                                                    KODE RUANG
                                                </p>
                                                <p className="text-ink mt-2 font-mono text-3xl font-semibold tracking-[0.3em] sm:text-4xl">
                                                    {code}
                                                </p>
                                                <p className="text-ink-muted mt-2 text-xs">
                                                    Enam karakter. Huruf
                                                    besar-kecil tidak
                                                    berpengaruh.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copy(code, 'code')
                                                }
                                                className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-xs font-semibold shadow-sm transition"
                                            >
                                                {copyState === 'code' ? (
                                                    <>
                                                        <CheckIcon className="text-success-ink h-4 w-4" />
                                                        Tersalin
                                                    </>
                                                ) : copyState === 'error' ? (
                                                    <>
                                                        <CopyIcon className="h-4 w-4" />
                                                        Gagal menyalin
                                                    </>
                                                ) : (
                                                    <>
                                                        <CopyIcon className="h-4 w-4" />
                                                        Salin kode
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <h2 className="text-ink text-sm font-semibold">
                                                Pemain
                                            </h2>
                                            <span className="text-ink-muted text-[11px] font-medium">
                                                Kursi 1 adalah tuan rumah
                                            </span>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {seats.map((seat, index) => (
                                                <div
                                                    key={`${seat.kind}-${index}`}
                                                    className={`flex min-h-[88px] items-center gap-3 rounded-[20px] border p-4 ${
                                                        seat.kind === 'empty'
                                                            ? 'border-line bg-surface-muted/35 border-dashed'
                                                            : 'border-line/80 bg-white shadow-sm'
                                                    }`}
                                                >
                                                    {seat.kind === 'empty' ? (
                                                        <span className="border-line text-ink-muted/60 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-dashed bg-white text-lg font-medium">
                                                            +
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold ${
                                                                seat.kind ===
                                                                'host'
                                                                    ? 'bg-ink text-white'
                                                                    : 'bg-brand/10 text-brand-ink'
                                                            }`}
                                                        >
                                                            {seat.name
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </span>
                                                    )}

                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={`truncate text-sm font-semibold ${
                                                                seat.kind ===
                                                                'empty'
                                                                    ? 'text-ink-muted'
                                                                    : 'text-ink'
                                                            }`}
                                                        >
                                                            {seat.name}
                                                        </p>
                                                        <div className="mt-1 flex items-center gap-1.5">
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.08em] uppercase ${
                                                                    seat.kind ===
                                                                    'host'
                                                                        ? 'bg-ink/8 text-ink-muted'
                                                                        : seat.kind ===
                                                                            'you'
                                                                          ? 'bg-brand/10 text-brand-ink'
                                                                          : 'bg-surface-muted text-ink-muted'
                                                                }`}
                                                            >
                                                                {seat.label}
                                                            </span>
                                                            {seat.kind ===
                                                                'you' && (
                                                                <span
                                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                                                        seat.ready
                                                                            ? 'bg-success/10 text-success-ink'
                                                                            : 'bg-warning/10 text-warning-ink'
                                                                    }`}
                                                                >
                                                                    {seat.ready
                                                                        ? 'Siap'
                                                                        : 'Belum siap'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {seat.kind === 'empty' && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                copy(
                                                                    shareLink,
                                                                    'link',
                                                                )
                                                            }
                                                            className="text-brand-ink hover:bg-brand/8 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition"
                                                        >
                                                            <LinkIcon className="h-3.5 w-3.5" />
                                                            Undang
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                <aside className="space-y-4">
                                    <section className="border-line/80 shadow-card rounded-[24px] border bg-white p-4 sm:p-5">
                                        <h2 className="text-ink text-sm font-semibold">
                                            Aksi pertandingan
                                        </h2>
                                        <div className="mt-4 flex flex-col gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setReady((value) => !value)
                                                }
                                                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition ${
                                                    ready
                                                        ? 'border-success/20 bg-success/10 text-success-ink border'
                                                        : 'bg-brand hover:bg-brand-dark text-white shadow-[0_10px_22px_-12px_rgba(47,107,239,0.8)]'
                                                }`}
                                            >
                                                {ready ? (
                                                    <>
                                                        <CheckIcon className="h-4 w-4" />
                                                        Siap bermain
                                                    </>
                                                ) : (
                                                    'Tandai siap'
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copy(shareLink, 'link')
                                                }
                                                className="border-line text-ink hover:border-ink/15 hover:bg-surface-muted inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-white text-xs font-semibold transition"
                                            >
                                                {copyState === 'link' ? (
                                                    <>
                                                        <CheckIcon className="text-success-ink h-4 w-4" />
                                                        Undangan tersalin
                                                    </>
                                                ) : (
                                                    <>
                                                        <LinkIcon className="h-4 w-4" />
                                                        Salin tautan undangan
                                                    </>
                                                )}
                                            </button>

                                            <Link
                                                href={route('play')}
                                                className="bg-ink hover:bg-ink/90 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white transition active:scale-[0.99]"
                                            >
                                                <ArrowRightIcon className="h-4 w-4" />
                                                Mulai pertandingan latihan
                                            </Link>

                                            <Link
                                                href={route('home')}
                                                className="text-ink-muted hover:bg-surface-muted hover:text-ink inline-flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition"
                                            >
                                                Tinggalkan ruang
                                            </Link>
                                        </div>

                                        <p className="bg-surface-muted text-ink-muted mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px] leading-5">
                                            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                            Kode ruang dan kursi masih berupa
                                            pratinjau UI. Pertandingan ruang
                                            online akan aktif saat pencarian
                                            lawan terhubung.
                                        </p>
                                    </section>

                                    <section className="border-line/80 shadow-card rounded-[24px] border bg-white p-4 sm:p-5">
                                        <h2 className="text-ink text-sm font-semibold">
                                            Aturan main
                                        </h2>
                                        <ul className="mt-3 space-y-2.5">
                                            {[
                                                'Dapat 6 untuk mengeluarkan bidak dari markas.',
                                                'Mendarat di bidak lawan akan memulangkannya, kecuali di petak aman.',
                                                'Butuh angka pas untuk masuk garis akhir.',
                                                'Setiap giliran online berdurasi 15 detik.',
                                            ].map((rule) => (
                                                <li
                                                    key={rule}
                                                    className="text-ink-muted flex items-start gap-2 text-[11px] leading-5"
                                                >
                                                    <span className="bg-brand/50 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                                                    {rule}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </aside>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
