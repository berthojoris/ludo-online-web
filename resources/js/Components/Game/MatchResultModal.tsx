import {
    CloseIcon,
    HomeIcon,
    RefreshIcon,
    TrophyIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import {
    CharacterId,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
} from '@/lib/ludo';
import { hasCoarsePointer, useModalViewport } from '@/lib/useModalViewport';
import { Link } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

export type MatchStanding = {
    color: PlayerColor;
    name: string;
    character?: CharacterId | string | null;
    role: 'Kamu' | 'Lawan';
    finished: number;
    captures: number;
    rolls: number;
};

type MatchResultModalProps = {
    open: boolean;
    winner: PlayerColor;
    human: PlayerColor;
    standings: MatchStanding[];
    durationSeconds: number;
    totalMoves: number;
    canRestart?: boolean;
    onPlayAgain: () => void;
    onOpenSetup: () => void;
    onClose: () => void;
};

function formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safe / 60);
    const remaining = safe % 60;

    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

export default function MatchResultModal({
    open,
    winner,
    human,
    standings,
    durationSeconds,
    totalMoves,
    canRestart = true,
    onPlayAgain,
    onOpenSetup,
    onClose,
}: MatchResultModalProps) {
    const playAgainRef = useRef<HTMLButtonElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
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
                (playAgainRef.current ?? closeRef.current)?.focus();
            }
        }, 40);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.clearTimeout(focusTimeout);
            window.removeEventListener('keydown', handleKeyDown);

            const opener = openerRef.current;
            openerRef.current = null;
            if (opener && document.contains(opener)) {
                opener.focus();
            }
        };
    }, [open]);

    if (!open) {
        return null;
    }

    const winnerEntry =
        standings.find((entry) => entry.color === winner) ?? standings[0];
    const winnerPalette = PLAYER_CONFIG[winner].palette;
    const isHumanWinner = winner === human;
    const totalRolls = standings.reduce((sum, entry) => sum + entry.rolls, 0);

    return (
        <div
            className="modal-overlay bg-ink/20"
            style={overlayStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-result-title"
            aria-describedby="match-result-subtitle"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className="modal-panel modal-bezel animate-modal-enter max-w-[min(100%,28rem)] outline-none"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="modal-bezel-card">
                <div className="flex items-center justify-between gap-3">
                    <span
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{
                            background: isHumanWinner
                                ? winnerPalette.soft
                                : '#f7f8fa',
                            borderColor: isHumanWinner
                                ? `${winnerPalette.base}33`
                                : '#e4e8ee',
                            color: isHumanWinner
                                ? winnerPalette.text
                                : '#5b6779',
                        }}
                    >
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: winnerPalette.base }}
                        />
                        {isHumanWinner ? 'Kemenangan' : 'Pertandingan selesai'}
                    </span>

                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup dialog dan lihat papan"
                        title="Lihat papan"
                        className="btn btn-quiet btn-sm btn-icon shrink-0"
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-4 text-center">
                    <div
                        className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border"
                        style={{
                            background: winnerPalette.soft,
                            borderColor: `${winnerPalette.base}30`,
                            color: winnerPalette.text,
                        }}
                    >
                        <TrophyIcon className="h-8 w-8" />
                    </div>

                    <h2
                        id="match-result-title"
                        className="text-ink mt-3.5 text-2xl font-semibold tracking-tight"
                    >
                        {isHumanWinner
                            ? 'Kamu menang!'
                            : `${winnerEntry?.name ?? PLAYER_CONFIG[winner].label} menang`}
                    </h2>
                    <p
                        id="match-result-subtitle"
                        className="text-ink-muted mx-auto mt-1 max-w-xs text-sm leading-5"
                    >
                        {isHumanWinner
                            ? 'Keempat bidakmu berhasil mencapai garis akhir lebih dulu.'
                            : `${winnerEntry?.name ?? PLAYER_CONFIG[winner].label} lebih dulu menyelesaikan keempat bidaknya.`}
                    </p>
                </div>

                <section
                    aria-label="Klasemen akhir"
                    className="border-line mt-5 overflow-hidden rounded-2xl border bg-white"
                >
                    <div className="border-line bg-canvas/80 flex items-center justify-between border-b px-3.5 py-2">
                        <span className="text-ink-muted text-xs font-semibold">
                            Klasemen akhir
                        </span>
                        <span className="text-ink-muted text-xs tabular-nums">
                            {standings.length} pemain
                        </span>
                    </div>

                    <ul className="divide-line divide-y">
                        {standings.map((entry, index) => {
                            const palette = PLAYER_CONFIG[entry.color].palette;
                            const charCfg = getCharacterConfig(
                                entry.character,
                                entry.color,
                            );
                            const isWinnerRow = entry.color === winner;

                            return (
                                <li
                                    key={entry.color}
                                    className="flex items-center gap-3 px-3.5 py-3"
                                    style={
                                        isWinnerRow
                                            ? {
                                                  background: `${palette.soft}66`,
                                              }
                                            : undefined
                                    }
                                >
                                    <span
                                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums"
                                        style={
                                            isWinnerRow
                                                ? {
                                                      background: palette.base,
                                                      color: '#ffffff',
                                                  }
                                                : {
                                                      background: '#f0f2f5',
                                                      color: '#5b6779',
                                                  }
                                        }
                                    >
                                        {index + 1}
                                    </span>

                                    <div
                                        className="relative h-9 w-9 shrink-0 rounded-full p-[2px]"
                                        style={{
                                            background: `linear-gradient(135deg, ${palette.base}, ${palette.dark})`,
                                        }}
                                    >
                                        <img
                                            src={charCfg.image}
                                            alt={charCfg.name}
                                            width={36}
                                            height={36}
                                            className="h-full w-full rounded-full bg-white object-cover"
                                        />
                                        <span
                                            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                                            style={{ background: palette.base }}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-ink truncate text-sm font-semibold">
                                                {entry.name}
                                            </p>
                                            <span
                                                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                                style={{
                                                    background: palette.soft,
                                                    color: palette.text,
                                                }}
                                            >
                                                {entry.role}
                                            </span>
                                        </div>
                                        <p className="text-ink-muted mt-0.5 text-xs">
                                            {charCfg.name} ·{' '}
                                            {PLAYER_CONFIG[entry.color].label}
                                            {entry.captures > 0
                                                ? ` · ${entry.captures} tangkapan`
                                                : ''}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <div
                                            className="flex items-center gap-1"
                                            aria-hidden="true"
                                        >
                                            {[0, 1, 2, 3].map((slot) => (
                                                <span
                                                    key={slot}
                                                    className="h-2 w-2 rounded-full"
                                                    style={{
                                                        background:
                                                            slot <
                                                            entry.finished
                                                                ? palette.base
                                                                : '#e4e8ee',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-ink-muted text-xs font-semibold tabular-nums">
                                            <span
                                                style={{ color: palette.text }}
                                            >
                                                {entry.finished}
                                            </span>
                                            /4
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <dl className="border-line bg-canvas/80 divide-line mt-3 grid grid-cols-3 divide-x rounded-2xl border py-2.5 text-center">
                    <div className="px-2">
                        <dt className="text-ink-muted text-[11px] font-medium">
                            Durasi
                        </dt>
                        <dd className="text-ink mt-0.5 text-sm font-semibold tabular-nums">
                            {formatDuration(durationSeconds)}
                        </dd>
                    </div>
                    <div className="px-2">
                        <dt className="text-ink-muted text-[11px] font-medium">
                            Lemparan
                        </dt>
                        <dd className="text-ink mt-0.5 text-sm font-semibold tabular-nums">
                            {totalRolls}
                        </dd>
                    </div>
                    <div className="px-2">
                        <dt className="text-ink-muted text-[11px] font-medium">
                            Langkah
                        </dt>
                        <dd className="text-ink mt-0.5 text-sm font-semibold tabular-nums">
                            {totalMoves}
                        </dd>
                    </div>
                </dl>

                <div className="mt-5 flex flex-col gap-2.5">
                    {canRestart ? (
                        <>
                            <button
                                ref={playAgainRef}
                                type="button"
                                onClick={onPlayAgain}
                                className="btn btn-primary w-full gap-2"
                            >
                                <RefreshIcon className="h-4 w-4" />
                                Main lagi
                            </button>

                            <div className="grid grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={onOpenSetup}
                                    className="btn btn-secondary min-w-0 gap-1.5"
                                >
                                    <UsersIcon className="h-4 w-4 shrink-0" />
                                    <span>Atur pemain</span>
                                </button>
                                <Link
                                    href={route('home')}
                                    className="btn btn-secondary min-w-0 gap-1.5"
                                >
                                    <HomeIcon className="h-4 w-4 shrink-0" />
                                    <span>Beranda</span>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-ink-muted text-center text-xs leading-5">
                                Hanya host yang bisa memulai pertandingan baru.
                            </p>
                            <Link
                                href={route('home')}
                                className="btn btn-secondary w-full gap-1.5"
                            >
                                <HomeIcon className="h-4 w-4 shrink-0" />
                                <span>Beranda</span>
                            </Link>
                        </>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
}
