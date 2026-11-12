import Dice from '@/Components/Game/Dice';
import {
    ChevronLeftIcon,
    DiceIcon,
    InfoIcon,
    RefreshIcon,
    SparklesIcon,
    TrophyIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import LudoBoard, { BoardToken } from '@/Components/Game/LudoBoard';
import PlayerCard from '@/Components/Game/PlayerCard';
import {
    absoluteTrackIndex,
    BASE_POSITION,
    FINISH_POSITION,
    isSafeAbsoluteIndex,
    PLAYER_CONFIG,
    PlayerColor,
    tokenPoint,
} from '@/lib/ludo';
import { User } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useReducer, useState } from 'react';

type PlayerId = Extract<PlayerColor, 'blue' | 'green'>;
type Phase = 'idle' | 'rolling' | 'choosing' | 'gameover';

type LegalMove = {
    tokenIndex: number;
    target: number;
};

type LogEntry = {
    id: number;
    text: string;
    color?: PlayerId;
};

type GameState = {
    tokens: Record<PlayerId, number[]>;
    turn: PlayerId;
    phase: Phase;
    dice: number | null;
    legalMoves: LegalMove[];
    winner: PlayerId | null;
    message: string;
    log: LogEntry[];
    logId: number;
};

type Action =
    | { type: 'ROLL_START' }
    | { type: 'ROLL_RESULT'; value: number }
    | { type: 'MOVE'; tokenIndex: number }
    | { type: 'RESET' };

const PLAYER_LABEL: Record<PlayerId, string> = {
    blue: 'Kamu',
    green: 'Lawan',
};

const initialState: GameState = {
    tokens: {
        blue: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
    },
    turn: 'blue',
    phase: 'idle',
    dice: null,
    legalMoves: [],
    winner: null,
    message: 'Giliranmu. Lempar dadu.',
    log: [
        {
            id: 0,
            text: 'Pertandingan latihan dimulai. Biru jalan lebih dulu.',
        },
    ],
    logId: 1,
};

function otherPlayer(player: PlayerId): PlayerId {
    return player === 'blue' ? 'green' : 'blue';
}

function randomDie(): number {
    return 1 + Math.floor(Math.random() * 6);
}

function appendLog(
    state: GameState,
    text: string,
    color?: PlayerId,
): Pick<GameState, 'log' | 'logId'> {
    return {
        log: [{ id: state.logId, text, color }, ...state.log].slice(0, 6),
        logId: state.logId + 1,
    };
}

function computeLegalMoves(
    tokens: Record<PlayerId, number[]>,
    player: PlayerId,
    roll: number,
): LegalMove[] {
    return tokens[player].flatMap((position, tokenIndex) => {
        if (position === FINISH_POSITION) {
            return [];
        }

        if (position === BASE_POSITION) {
            return roll === 6 ? [{ tokenIndex, target: 0 }] : [];
        }

        const target = position + roll;

        return target <= FINISH_POSITION ? [{ tokenIndex, target }] : [];
    });
}

function chooseAiMove(state: GameState): LegalMove | null {
    if (state.legalMoves.length === 0) {
        return null;
    }

    const opponent = otherPlayer(state.turn);

    const score = (move: LegalMove) => {
        let value = move.target / 10;
        const from = state.tokens[state.turn][move.tokenIndex];

        if (from === BASE_POSITION) {
            value += 12;
        }

        if (move.target >= 51) {
            value += 30;
        }

        if (move.target === FINISH_POSITION) {
            value += 60;
        }

        if (move.target <= 50) {
            const absolute = absoluteTrackIndex(state.turn, move.target);

            if (
                !isSafeAbsoluteIndex(absolute) &&
                state.tokens[opponent].some(
                    (position) =>
                        absoluteTrackIndex(opponent, position) === absolute,
                )
            ) {
                value += 80;
            }
        }

        return value;
    };

    return [...state.legalMoves].sort((a, b) => score(b) - score(a))[0];
}

function reducer(state: GameState, action: Action): GameState {
    if (action.type === 'RESET') {
        return initialState;
    }

    if (action.type === 'ROLL_START') {
        if (state.phase !== 'idle' || state.winner) {
            return state;
        }

        return {
            ...state,
            phase: 'rolling',
            legalMoves: [],
            message:
                state.turn === 'blue'
                    ? 'Melempar dadu…'
                    : 'Lawan sedang melempar…',
        };
    }

    if (action.type === 'ROLL_RESULT') {
        if (state.phase !== 'rolling') {
            return state;
        }

        const legalMoves = computeLegalMoves(
            state.tokens,
            state.turn,
            action.value,
        );
        const actor = PLAYER_LABEL[state.turn];
        const logged = appendLog(
            state,
            `${actor} melempar ${action.value}.`,
            state.turn,
        );

        if (legalMoves.length === 0) {
            const nextPlayer = otherPlayer(state.turn);

            return {
                ...state,
                ...logged,
                dice: action.value,
                legalMoves: [],
                phase: 'idle',
                turn: nextPlayer,
                message:
                    state.turn === 'blue'
                        ? 'Tidak ada langkah yang bisa diambil. Giliran lawan.'
                        : 'Lawan tidak punya langkah. Giliranmu.',
            };
        }

        return {
            ...state,
            ...logged,
            dice: action.value,
            legalMoves,
            phase: 'choosing',
            message:
                state.turn === 'blue'
                    ? 'Pilih bidak yang menyala untuk digerakkan.'
                    : 'Lawan sedang memilih langkah…',
        };
    }

    if (action.type === 'MOVE') {
        if (state.phase !== 'choosing' || state.winner) {
            return state;
        }

        const move = state.legalMoves.find(
            (candidate) => candidate.tokenIndex === action.tokenIndex,
        );

        if (!move || state.dice === null) {
            return state;
        }

        const actor = state.turn;
        const opponent = otherPlayer(actor);
        const from = state.tokens[actor][move.tokenIndex];
        const nextTokens: Record<PlayerId, number[]> = {
            blue: [...state.tokens.blue],
            green: [...state.tokens.green],
        };

        nextTokens[actor][move.tokenIndex] = move.target;

        let captured = false;

        if (move.target <= 50) {
            const absolute = absoluteTrackIndex(actor, move.target);

            if (!isSafeAbsoluteIndex(absolute)) {
                nextTokens[opponent] = nextTokens[opponent].map((position) => {
                    if (absoluteTrackIndex(opponent, position) === absolute) {
                        captured = true;

                        return BASE_POSITION;
                    }

                    return position;
                });
            }
        }

        const reachedHome = move.target === FINISH_POSITION;
        const won = nextTokens[actor].every(
            (position) => position === FINISH_POSITION,
        );
        const extraTurn = state.dice === 6 || captured || reachedHome || won;

        const moveDescription =
            from === BASE_POSITION
                ? 'mengeluarkan bidak dari markas'
                : `menggerakkan bidak ${state.dice} langkah`;
        const extraDescription = reachedHome
            ? ' dan membawanya ke garis akhir'
            : captured
              ? ' dan menangkap bidak lawan'
              : '';
        const logged = appendLog(
            state,
            `${PLAYER_LABEL[actor]} ${moveDescription}${extraDescription}.`,
            actor,
        );

        if (won) {
            return {
                ...state,
                ...logged,
                tokens: nextTokens,
                legalMoves: [],
                phase: 'gameover',
                winner: actor,
                message:
                    actor === 'blue'
                        ? 'Kamu membawa semua bidak ke garis akhir. Kamu menang!'
                        : 'Lawan membawa semua bidak ke garis akhir.',
            };
        }

        if (extraTurn) {
            return {
                ...state,
                ...logged,
                tokens: nextTokens,
                legalMoves: [],
                phase: 'idle',
                turn: actor,
                message:
                    actor === 'blue'
                        ? 'Dapat lemparan tambahan. Lempar lagi.'
                        : 'Lawan mendapat lemparan tambahan.',
            };
        }

        return {
            ...state,
            ...logged,
            tokens: nextTokens,
            legalMoves: [],
            phase: 'idle',
            turn: opponent,
            message:
                opponent === 'blue'
                    ? 'Giliranmu. Lempar dadu.'
                    : 'Giliran lawan.',
        };
    }

    return state;
}

export default function Play() {
    const { auth } = usePage().props as unknown as {
        auth?: { user: User | null };
    };
    const playerName = auth?.user?.name?.split(' ')[0] ?? 'Guest';
    const [state, dispatch] = useReducer(reducer, initialState);
    const [rollingFace, setRollingFace] = useState(1);

    const canRoll =
        state.turn === 'blue' && state.phase === 'idle' && !state.winner;
    const displayDice =
        state.phase === 'rolling' ? rollingFace : (state.dice ?? 6);

    useEffect(() => {
        if (state.phase !== 'rolling') {
            return;
        }

        const interval = window.setInterval(() => {
            setRollingFace(randomDie());
        }, 90);

        return () => window.clearInterval(interval);
    }, [state.phase]);

    useEffect(() => {
        if (state.phase !== 'rolling') {
            return;
        }

        const timeout = window.setTimeout(() => {
            dispatch({ type: 'ROLL_RESULT', value: randomDie() });
        }, 950);

        return () => window.clearTimeout(timeout);
    }, [state.phase]);

    useEffect(() => {
        if (state.turn !== 'green' || state.phase !== 'idle' || state.winner) {
            return;
        }

        const timeout = window.setTimeout(() => {
            dispatch({ type: 'ROLL_START' });
        }, 1050);

        return () => window.clearTimeout(timeout);
    }, [state.turn, state.phase, state.winner]);

    useEffect(() => {
        if (state.phase !== 'choosing' || state.legalMoves.length === 0) {
            return;
        }

        if (state.turn === 'blue' && state.legalMoves.length !== 1) {
            return;
        }

        const tokenIndex =
            state.turn === 'green'
                ? chooseAiMove(state)?.tokenIndex
                : state.legalMoves[0].tokenIndex;

        if (tokenIndex === undefined) {
            return;
        }

        const timeout = window.setTimeout(
            () => {
                dispatch({ type: 'MOVE', tokenIndex });
            },
            state.turn === 'green' ? 850 : 650,
        );

        return () => window.clearTimeout(timeout);
    }, [state]);

    const boardTokens = useMemo<BoardToken[]>(() => {
        return (['blue', 'green'] as PlayerId[]).flatMap((color) =>
            state.tokens[color].map((position, tokenIndex) => {
                const move =
                    state.turn === color && state.phase === 'choosing'
                        ? state.legalMoves.find(
                              (candidate) =>
                                  candidate.tokenIndex === tokenIndex,
                          )
                        : undefined;

                return {
                    id: `${color}-${tokenIndex}`,
                    color,
                    point: tokenPoint(color, position, tokenIndex),
                    legal: Boolean(move),
                    onClick: move
                        ? () =>
                              dispatch({
                                  type: 'MOVE',
                                  tokenIndex,
                              })
                        : undefined,
                    label: `${
                        color === 'blue' ? 'Bidakmu' : 'Bidak lawan'
                    } ${tokenIndex + 1}`,
                };
            }),
        );
    }, [state.tokens, state.turn, state.phase, state.legalMoves]);

    const finished = (color: PlayerId) =>
        state.tokens[color].filter((position) => position === FINISH_POSITION)
            .length;

    const activeSubtitle = (color: PlayerId) => {
        if (state.winner) {
            return state.winner === color
                ? 'Pemenang pertandingan'
                : 'Pertandingan selesai';
        }

        if (state.turn !== color) {
            return 'Menunggu giliran';
        }

        if (state.phase === 'rolling') {
            return 'Melempar dadu';
        }

        if (state.phase === 'choosing') {
            return color === 'blue'
                ? 'Pilih bidak untuk digerakkan'
                : 'Sedang memilih langkah';
        }

        return color === 'blue' ? 'Giliranmu' : 'Siap melempar';
    };

    return (
        <>
            <Head title="Papan latihan" />

            <div className="min-h-screen">
                <header className="border-line/60 bg-canvas/85 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
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
                                Latihan
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="border-line text-ink-muted inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-[11px] font-semibold">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="bg-ludo-green absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                                    <span className="bg-ludo-green relative inline-flex h-1.5 w-1.5 rounded-full" />
                                </span>
                                Demo lokal
                            </span>
                            <Link
                                href={route('home')}
                                className="text-ink-muted hover:text-ink hidden rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-white sm:inline-flex"
                            >
                                Keluar
                            </Link>
                        </div>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:py-8">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                        <section className="mx-auto flex w-full max-w-[560px] flex-col gap-3 sm:gap-4">
                            <PlayerCard
                                color="green"
                                name="Lawan"
                                role="Lawan"
                                subtitle={activeSubtitle('green')}
                                active={state.turn === 'green' && !state.winner}
                                finished={finished('green')}
                            />

                            <div className="border-line/70 shadow-board rounded-[26px] border bg-white/80 p-2 backdrop-blur-sm sm:p-2.5">
                                <LudoBoard tokens={boardTokens} />
                            </div>

                            <PlayerCard
                                color="blue"
                                name={playerName}
                                role="Kamu"
                                subtitle={activeSubtitle('blue')}
                                active={state.turn === 'blue' && !state.winner}
                                finished={finished('blue')}
                            />
                        </section>

                        <aside className="flex flex-col gap-4">
                            <section className="border-line/80 shadow-card rounded-[24px] border bg-white p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-brand-ink text-[10px] font-semibold tracking-[0.16em]">
                                            {state.winner
                                                ? 'PERTANDINGAN SELESAI'
                                                : state.turn === 'blue'
                                                  ? 'GILIRANMU'
                                                  : 'GILIRAN LAWAN'}
                                        </p>
                                        <p
                                            className="text-ink mt-1.5 text-sm leading-5 font-semibold"
                                            aria-live="polite"
                                        >
                                            {state.message}
                                        </p>
                                    </div>
                                    <Dice
                                        value={displayDice}
                                        rolling={state.phase === 'rolling'}
                                        className="h-14 w-14 shrink-0"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        dispatch({ type: 'ROLL_START' })
                                    }
                                    disabled={!canRoll}
                                    className="bg-brand hover:bg-brand-dark disabled:bg-surface-muted disabled:text-ink-muted mt-4 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.85)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    <DiceIcon className="h-5 w-5" />
                                    {state.phase === 'rolling'
                                        ? 'Melempar…'
                                        : state.phase === 'choosing' &&
                                            state.turn === 'blue'
                                          ? 'Ketuk bidak yang menyala'
                                          : 'Lempar dadu'}
                                </button>

                                <p className="text-ink-muted mt-3 text-[11px] leading-5">
                                    Mode latihan. Lemparan dan langkah berjalan
                                    lokal di browser kamu; pertandingan online
                                    akan memakai mesin server.
                                </p>
                            </section>

                            <section className="border-line/80 shadow-card rounded-[24px] border bg-white p-4">
                                <div className="flex items-center gap-2">
                                    <span className="bg-brand/10 text-brand-ink grid h-7 w-7 place-items-center rounded-lg">
                                        <InfoIcon className="h-4 w-4" />
                                    </span>
                                    <h2 className="text-ink text-sm font-semibold">
                                        Papan latihan
                                    </h2>
                                </div>
                                <p className="text-ink-muted mt-2.5 text-xs leading-5">
                                    Lempar 6 untuk keluar dari markas. Ketuk
                                    bidak yang menyala untuk bergerak, tangkap
                                    lawan di petak terbuka, dan bawa keempat
                                    bidak ke garis akhir untuk menang.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-1 text-[10px] font-semibold">
                                        2 pemain
                                    </span>
                                    <span className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-1 text-[10px] font-semibold">
                                        Biru vs Hijau
                                    </span>
                                    <span className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-1 text-[10px] font-semibold">
                                        Lokal
                                    </span>
                                </div>
                            </section>

                            <section className="border-line/80 shadow-card rounded-[24px] border bg-white p-4">
                                <h2 className="text-ink text-sm font-semibold">
                                    Riwayat pertandingan
                                </h2>
                                <ol className="mt-3 space-y-2.5">
                                    {state.log.map((entry) => {
                                        const palette = entry.color
                                            ? PLAYER_CONFIG[entry.color].palette
                                            : null;

                                        return (
                                            <li
                                                key={entry.id}
                                                className="flex items-start gap-2.5"
                                            >
                                                <span
                                                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                                    style={{
                                                        background:
                                                            palette?.base ??
                                                            '#c9d1dd',
                                                    }}
                                                />
                                                <span className="text-ink-muted text-[11px] leading-4">
                                                    {entry.text}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        </aside>
                    </div>
                </main>
            </div>

            {state.winner && (
                <div
                    className="bg-ink/35 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="result-title"
                >
                    <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white p-6 text-center shadow-[0_30px_80px_-20px_rgba(32,43,58,0.5)]">
                        <div
                            aria-hidden="true"
                            className="from-ludo-red via-ludo-yellow to-ludo-green absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r"
                        />
                        <div
                            className="mx-auto grid h-16 w-16 place-items-center rounded-[22px]"
                            style={{
                                background:
                                    PLAYER_CONFIG[state.winner].palette.soft,
                                color: PLAYER_CONFIG[state.winner].palette.text,
                            }}
                        >
                            <TrophyIcon className="h-8 w-8" />
                        </div>
                        <h2
                            id="result-title"
                            className="text-ink mt-4 text-2xl font-semibold tracking-tight"
                        >
                            {state.winner === 'blue'
                                ? 'Kamu menang!'
                                : 'Lawan menang'}
                        </h2>
                        <p className="text-ink-muted mt-2 text-sm leading-6">
                            {state.winner === 'blue'
                                ? 'Keempat bidak sudah di garis akhir. Permainan bagus.'
                                : 'Lawan lebih dulu membawa keempat bidaknya ke garis akhir.'}
                        </p>

                        <div className="mt-5 flex flex-col gap-2.5">
                            <button
                                type="button"
                                onClick={() => dispatch({ type: 'RESET' })}
                                className="bg-brand hover:bg-brand-dark inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.8)] transition active:scale-[0.99]"
                            >
                                <RefreshIcon className="h-4.5 w-4.5" />
                                Main lagi
                            </button>
                            <Link
                                href={route('home')}
                                className="border-line text-ink hover:bg-surface-muted inline-flex h-12 items-center justify-center rounded-2xl border bg-white text-sm font-semibold transition"
                            >
                                Kembali ke beranda
                            </Link>
                        </div>

                        <p className="text-ink-muted mt-4 inline-flex items-center gap-1 text-[10px] font-medium">
                            <SparklesIcon className="h-3 w-3" />
                            Pertandingan latihan · demo lokal
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
