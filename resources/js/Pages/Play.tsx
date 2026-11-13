import Dice from '@/Components/Game/Dice';
import {
    ChevronLeftIcon,
    DiceIcon,
    RefreshIcon,
    SoundOffIcon,
    SoundOnIcon,
    SparklesIcon,
    TrophyIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import LudoBoard, { BoardToken } from '@/Components/Game/LudoBoard';
import MatchResultModal, {
    MatchStanding,
} from '@/Components/Game/MatchResultModal';
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
import {
    isSoundEnabled,
    playCaptureSound,
    playDefeatSound,
    playDiceRollSound,
    playFinishSound,
    playHopSound,
    playNoMoveSound,
    playStartSound,
    playTurnSound,
    playUiSound,
    playWinSound,
    setSoundEnabled,
    unlockAudio,
} from '@/lib/sound';
import { User } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';

type PlayerId = Extract<PlayerColor, 'blue' | 'green'>;
type Phase = 'idle' | 'rolling' | 'choosing' | 'gameover';
type Screen = 'setup' | 'game';

type LegalMove = {
    tokenIndex: number;
    target: number;
};

type LogEntry = {
    id: number;
    text: string;
    color?: PlayerId;
};

type SetupNames = Record<PlayerId, string>;

type GameState = {
    tokens: Record<PlayerId, number[]>;
    turn: PlayerId;
    human: PlayerId;
    names: SetupNames;
    phase: Phase;
    dice: number | null;
    legalMoves: LegalMove[];
    winner: PlayerId | null;
    message: string;
    log: LogEntry[];
    logId: number;
    rolls: Record<PlayerId, number>;
    captures: Record<PlayerId, number>;
    totalMoves: number;
    startedAt: number | null;
    finishedAt: number | null;
};

type Action =
    | { type: 'START'; human: PlayerId; names: SetupNames; now: number }
    | { type: 'ROLL_START'; value: number }
    | { type: 'ROLL_RESULT'; value: number }
    | { type: 'MOVE'; tokenIndex: number; now: number }
    | { type: 'RESET'; now: number };

const PLAYER_IDS: PlayerId[] = ['blue', 'green'];

const initialState: GameState = {
    tokens: {
        blue: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
    },
    turn: 'blue',
    human: 'blue',
    names: { blue: 'Kamu', green: 'Lawan' },
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
    rolls: { blue: 0, green: 0 },
    captures: { blue: 0, green: 0 },
    totalMoves: 0,
    startedAt: null,
    finishedAt: null,
};

function otherPlayer(player: PlayerId): PlayerId {
    return player === 'blue' ? 'green' : 'blue';
}

function randomDie(): number {
    return 1 + Math.floor(Math.random() * 6);
}

function cleanNames(human: PlayerId, names: SetupNames): SetupNames {
    const opponent = otherPlayer(human);

    return {
        [human]: names[human].trim().slice(0, 16) || 'Pemain',
        [opponent]: names[opponent].trim().slice(0, 16) || 'Lawan',
    } as SetupNames;
}

function createInitialState(
    human: PlayerId,
    rawNames: SetupNames,
    now: number,
): GameState {
    const names = cleanNames(human, rawNames);

    return {
        ...initialState,
        human,
        names,
        turn: human,
        message: `${names[human]}, giliranmu. Lempar dadu.`,
        log: [
            {
                id: 0,
                text: `${names[human]} (${PLAYER_CONFIG[human].label}) jalan lebih dulu.`,
                color: human,
            },
        ],
        logId: 1,
        rolls: { blue: 0, green: 0 },
        captures: { blue: 0, green: 0 },
        totalMoves: 0,
        startedAt: now,
        finishedAt: null,
    };
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
    if (action.type === 'START') {
        return createInitialState(action.human, action.names, action.now);
    }

    if (action.type === 'RESET') {
        return createInitialState(state.human, state.names, action.now);
    }

    if (action.type === 'ROLL_START') {
        if (state.phase !== 'idle' || state.winner) {
            return state;
        }

        return {
            ...state,
            phase: 'rolling',
            dice: action.value,
            legalMoves: [],
            rolls: {
                ...state.rolls,
                [state.turn]: state.rolls[state.turn] + 1,
            },
            message:
                state.turn === state.human
                    ? 'Melempar dadu…'
                    : `${state.names[state.turn]} sedang melempar…`,
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
        const actor = state.names[state.turn];
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
                    state.turn === state.human
                        ? 'Tidak ada langkah yang bisa diambil. Giliran lawan.'
                        : `${actor} tidak punya langkah. Giliranmu.`,
            };
        }

        return {
            ...state,
            ...logged,
            dice: action.value,
            legalMoves,
            phase: 'choosing',
            message:
                state.turn === state.human
                    ? 'Pilih bidak yang menyala untuk digerakkan.'
                    : `${actor} sedang memilih langkah…`,
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
        const actorName = state.names[actor];
        const from = state.tokens[actor][move.tokenIndex];
        const nextTokens: Record<PlayerId, number[]> = {
            blue: [...state.tokens.blue],
            green: [...state.tokens.green],
        };

        nextTokens[actor][move.tokenIndex] = move.target;

        let capturedCount = 0;

        if (move.target <= 50) {
            const absolute = absoluteTrackIndex(actor, move.target);

            if (!isSafeAbsoluteIndex(absolute)) {
                nextTokens[opponent] = nextTokens[opponent].map((position) => {
                    if (absoluteTrackIndex(opponent, position) === absolute) {
                        capturedCount += 1;

                        return BASE_POSITION;
                    }

                    return position;
                });
            }
        }

        const captured = capturedCount > 0;
        const reachedHome = move.target === FINISH_POSITION;
        const won = nextTokens[actor].every(
            (position) => position === FINISH_POSITION,
        );
        const extraTurn = state.dice === 6 || captured || reachedHome || won;
        const nextCaptures = captured
            ? {
                  ...state.captures,
                  [actor]: state.captures[actor] + capturedCount,
              }
            : state.captures;
        const nextTotalMoves = state.totalMoves + 1;

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
            `${actorName} ${moveDescription}${extraDescription}.`,
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
                captures: nextCaptures,
                totalMoves: nextTotalMoves,
                finishedAt: action.now,
                message:
                    actor === state.human
                        ? `${actorName} membawa semua bidak ke garis akhir. Kamu menang!`
                        : `${actorName} membawa semua bidak ke garis akhir.`,
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
                captures: nextCaptures,
                totalMoves: nextTotalMoves,
                message:
                    actor === state.human
                        ? 'Dapat lemparan tambahan. Lempar lagi.'
                        : `${actorName} mendapat lemparan tambahan.`,
            };
        }

        return {
            ...state,
            ...logged,
            tokens: nextTokens,
            legalMoves: [],
            phase: 'idle',
            turn: opponent,
            captures: nextCaptures,
            totalMoves: nextTotalMoves,
            message:
                opponent === state.human
                    ? 'Giliranmu. Lempar dadu.'
                    : `Giliran ${state.names[opponent]}.`,
        };
    }

    return state;
}

type MovingToken = {
    color: PlayerId;
    tokenIndex: number;
    position: number;
};

function useBoardSize(active: boolean) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(0);

    useEffect(() => {
        const element = ref.current;

        if (!active || !element) {
            return;
        }

        const measure = () => {
            const rect = element.getBoundingClientRect();

            setSize(Math.max(0, Math.floor(Math.min(rect.width, rect.height))));
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(element);
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, [active]);

    return [ref, size] as const;
}

export default function Play() {
    const { auth, room, me } = usePage().props as unknown as {
        auth?: { user: User | null };
        room?: {
            code: string;
            max_players: number;
            status: string;
            players: {
                id: number;
                name: string;
                seat_color: PlayerColor | null;
                is_ready: boolean;
                is_host: boolean;
            }[];
        } | null;
        me?: {
            id: number;
            name: string;
            seat_color: PlayerColor | null;
        } | null;
    };
    const accountName = me?.name ?? auth?.user?.name?.split(' ')[0] ?? 'Pemain';
    const roomOtherPlayer = room?.players.find((p) => p.id !== me?.id);

    const [screen, setScreen] = useState<Screen>(room ? 'game' : 'setup');
    const [humanColor, setHumanColor] = useState<PlayerId>('blue');
    const [yourName, setYourName] = useState(accountName);
    const [opponentName, setOpponentName] = useState(
        roomOtherPlayer?.name ?? 'Lawan',
    );
    const [state, dispatch] = useReducer(reducer, initialState);
    const [movingToken, setMovingToken] = useState<MovingToken | null>(null);
    const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [boardRef, boardSize] = useBoardSize(screen === 'game');
    const movingRef = useRef(false);
    const previousTurnRef = useRef<PlayerId | null>(null);

    useEffect(() => {
        if (!room) {
            return;
        }

        const other = room.players.find((p) => p.id !== me?.id);
        dispatch({
            type: 'START',
            human: 'blue',
            names: {
                blue: accountName,
                green: other?.name ?? 'Lawan',
            },
            now: Date.now(),
        });
        setScreen('game');
    }, [room?.code]);

    const opponentColor = otherPlayer(state.human);
    const canRoll =
        state.turn === state.human && state.phase === 'idle' && !state.winner;
    const displayDice = state.dice ?? 6;
    const setupOpponent = otherPlayer(humanColor);

    useEffect(() => {
        const previous = document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    useEffect(() => {
        if (state.phase !== 'rolling' || state.dice === null) {
            return;
        }

        const value = state.dice;

        playDiceRollSound();

        const timeout = window.setTimeout(() => {
            const hasMoves =
                computeLegalMoves(state.tokens, state.turn, value).length > 0;

            dispatch({ type: 'ROLL_RESULT', value });

            if (!hasMoves) {
                playNoMoveSound();
            }
        }, 1080);

        return () => window.clearTimeout(timeout);
    }, [state.phase, state.dice, state.tokens, state.turn]);

    useEffect(() => {
        const previous = previousTurnRef.current;

        previousTurnRef.current = state.turn;

        if (previous === null || previous === state.turn || state.winner) {
            return;
        }

        playTurnSound(state.turn === state.human);
    }, [state.turn, state.human, state.winner]);

    useEffect(() => {
        if (!state.winner) {
            setResultModalOpen(false);

            return;
        }

        setResultModalOpen(true);

        if (state.winner === state.human) {
            playWinSound();
        } else {
            playDefeatSound();
        }
    }, [state.winner, state.human]);

    useEffect(() => {
        if (
            state.turn === state.human ||
            state.phase !== 'idle' ||
            state.winner
        ) {
            return;
        }

        const timeout = window.setTimeout(() => {
            dispatch({ type: 'ROLL_START', value: randomDie() });
        }, 900);

        return () => window.clearTimeout(timeout);
    }, [state.turn, state.phase, state.winner, state.human]);

    const animateMove = useCallback(
        async (tokenIndex: number) => {
            if (movingRef.current || state.phase !== 'choosing') {
                return;
            }

            const move = state.legalMoves.find(
                (candidate) => candidate.tokenIndex === tokenIndex,
            );

            if (!move) {
                return;
            }

            const color = state.turn;
            const opponent = otherPlayer(color);
            const from = state.tokens[color][tokenIndex];
            const steps =
                from === BASE_POSITION
                    ? [0]
                    : Array.from(
                          { length: move.target - from },
                          (_, index) => from + index + 1,
                      );

            if (steps.length === 0) {
                return;
            }

            let captures = false;

            if (move.target <= 50) {
                const absolute = absoluteTrackIndex(color, move.target);

                if (!isSafeAbsoluteIndex(absolute)) {
                    captures = state.tokens[opponent].some(
                        (position) =>
                            absoluteTrackIndex(opponent, position) === absolute,
                    );
                }
            }

            movingRef.current = true;
            void unlockAudio();

            for (const [index, position] of steps.entries()) {
                setMovingToken({ color, tokenIndex, position });
                playHopSound(index);
                await new Promise((resolve) => window.setTimeout(resolve, 140));
            }

            if (captures) {
                playCaptureSound();
            } else if (move.target === FINISH_POSITION) {
                playFinishSound();
            }

            dispatch({ type: 'MOVE', tokenIndex, now: Date.now() });
            setMovingToken(null);
            movingRef.current = false;
        },
        [state.phase, state.legalMoves, state.tokens, state.turn],
    );

    useEffect(() => {
        if (
            state.phase !== 'choosing' ||
            state.legalMoves.length === 0 ||
            state.winner
        ) {
            return;
        }

        if (state.turn === state.human && state.legalMoves.length !== 1) {
            return;
        }

        const tokenIndex =
            state.turn === state.human
                ? state.legalMoves[0].tokenIndex
                : chooseAiMove(state)?.tokenIndex;

        if (tokenIndex === undefined) {
            return;
        }

        const timeout = window.setTimeout(
            () => {
                void animateMove(tokenIndex);
            },
            state.turn === state.human ? 600 : 800,
        );

        return () => window.clearTimeout(timeout);
    }, [state, animateMove]);

    const boardTokens = useMemo<BoardToken[]>(() => {
        return PLAYER_IDS.flatMap((color) =>
            state.tokens[color].map((position, tokenIndex) => {
                const isMoving =
                    movingToken?.color === color &&
                    movingToken.tokenIndex === tokenIndex;
                const displayPosition = isMoving
                    ? movingToken.position
                    : position;
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
                    point: tokenPoint(color, displayPosition, tokenIndex),
                    legal: Boolean(move) && !isMoving,
                    moving: isMoving,
                    onClick: move
                        ? () => {
                              void animateMove(tokenIndex);
                          }
                        : undefined,
                    label: `${state.names[color]} bidak ${tokenIndex + 1}`,
                };
            }),
        );
    }, [
        state.tokens,
        state.turn,
        state.phase,
        state.legalMoves,
        state.names,
        movingToken,
        animateMove,
    ]);

    const finished = (color: PlayerId) =>
        state.tokens[color].filter((position) => position === FINISH_POSITION)
            .length;

    const outOfBase = (color: PlayerId) =>
        state.tokens[color].filter((position) => position !== BASE_POSITION)
            .length;

    const standings = useMemo<MatchStanding[]>(() => {
        if (!state.winner) {
            return [];
        }

        const finishedCount = (color: PlayerId) =>
            state.tokens[color].filter(
                (position) => position === FINISH_POSITION,
            ).length;

        return [...PLAYER_IDS]
            .sort((a, b) => {
                if (a === state.winner) {
                    return -1;
                }
                if (b === state.winner) {
                    return 1;
                }

                return finishedCount(b) - finishedCount(a);
            })
            .map((color) => ({
                color,
                name: state.names[color],
                role: color === state.human ? 'Kamu' : 'Lawan',
                finished: finishedCount(color),
                captures: state.captures[color],
                rolls: state.rolls[color],
            }));
    }, [
        state.winner,
        state.tokens,
        state.names,
        state.human,
        state.captures,
        state.rolls,
    ]);

    const durationSeconds =
        state.startedAt && state.finishedAt
            ? Math.max(
                  1,
                  Math.round((state.finishedAt - state.startedAt) / 1000),
              )
            : 0;

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
            return color === state.human
                ? 'Pilih bidak untuk digerakkan'
                : 'Sedang memilih langkah';
        }

        return color === state.human ? 'Giliranmu' : 'Siap melempar';
    };

    const turnLabel = state.winner
        ? 'PERTANDINGAN SELESAI'
        : state.turn === state.human
          ? 'GILIRANMU'
          : `GILIRAN ${state.names[state.turn].toUpperCase()}`;

    const rollLabel =
        state.phase === 'rolling'
            ? 'Melempar…'
            : state.phase === 'choosing' && state.turn === state.human
              ? 'Ketuk bidak yang menyala'
              : 'Lempar dadu';

    const canExitBase =
        state.turn === state.human &&
        state.phase === 'choosing' &&
        state.dice === 6 &&
        state.legalMoves.some(
            (move) =>
                state.tokens[state.turn][move.tokenIndex] === BASE_POSITION,
        );

    const instruction = canExitBase
        ? 'Dadu 6! Ketuk bidak di markas untuk keluar'
        : state.message;

    const mobileInstruction = canExitBase
        ? 'Dadu 6 — keluarkan bidak'
        : state.message;

    const rollPalette = PLAYER_CONFIG[state.turn].palette;
    const rollButtonStyle = {
        background: canRoll ? rollPalette.dark : rollPalette.soft,
        color: canRoll ? '#ffffff' : rollPalette.text,
        boxShadow: canRoll
            ? `0 12px 26px -12px ${rollPalette.dark}D9`
            : `inset 0 0 0 1px ${rollPalette.base}2e`,
    };

    const handleRoll = () => {
        void unlockAudio();
        dispatch({ type: 'ROLL_START', value: randomDie() });
    };

    const cue = (sound: () => void) => {
        void unlockAudio().then(sound);
    };

    const toggleSound = () => {
        const next = !soundOn;

        setSoundOn(next);
        setSoundEnabled(next);

        if (next) {
            cue(playUiSound);
        }
    };

    const selectColor = (color: PlayerId) => {
        setHumanColor(color);
        cue(playUiSound);
    };

    const startGame = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const names = {
            [humanColor]: yourName,
            [setupOpponent]: opponentName,
        } as SetupNames;

        cue(playStartSound);
        previousTurnRef.current = humanColor;
        dispatch({ type: 'START', human: humanColor, names, now: Date.now() });
        setMovingToken(null);
        movingRef.current = false;
        setScreen('game');
    };

    const openSetup = () => {
        cue(playUiSound);
        setHumanColor(state.human);
        setYourName(state.names[state.human]);
        setOpponentName(state.names[opponentColor]);
        setScreen('setup');
    };

    const playAgain = () => {
        cue(playStartSound);
        previousTurnRef.current = state.human;
        setMovingToken(null);
        movingRef.current = false;
        dispatch({ type: 'RESET', now: Date.now() });
    };

    return (
        <>
            <Head
                title={screen === 'setup' ? 'Siapkan pemain' : 'Papan latihan'}
            />

            <div className="bg-canvas flex h-screen min-h-0 w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]">
                <header className="border-line/60 bg-canvas/90 shrink-0 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-2 px-3 sm:h-14 sm:px-6">
                        <div className="flex min-w-0 items-center gap-2">
                            <Link
                                href={route('home')}
                                aria-label="Kembali ke beranda"
                                className="border-line text-ink-muted hover:text-ink grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-white shadow-sm transition"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Link>
                            <Link href={route('home')} className="rounded-lg">
                                <Logo
                                    className="h-7 w-7"
                                    withWordmark
                                    compact
                                />
                            </Link>
                            <span className="border-line text-ink-muted hidden rounded-full border bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase md:inline-flex">
                                {room ? `Ruang ${room.code}` : 'Latihan'}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {screen === 'game' && (
                                <span
                                    className="border-line hidden items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold sm:inline-flex"
                                    style={{
                                        color: PLAYER_CONFIG[state.human]
                                            .palette.text,
                                    }}
                                >
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{
                                            background:
                                                PLAYER_CONFIG[state.human]
                                                    .palette.base,
                                        }}
                                    />
                                    {state.names[state.human]}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={toggleSound}
                                aria-pressed={soundOn}
                                aria-label={
                                    soundOn
                                        ? 'Matikan efek suara'
                                        : 'Nyalakan efek suara'
                                }
                                title={
                                    soundOn
                                        ? 'Matikan efek suara'
                                        : 'Nyalakan efek suara'
                                }
                                className="border-line text-ink-muted hover:text-ink grid h-8 w-8 place-items-center rounded-full border bg-white transition"
                            >
                                {soundOn ? (
                                    <SoundOnIcon className="h-4 w-4" />
                                ) : (
                                    <SoundOffIcon className="h-4 w-4" />
                                )}
                            </button>
                            <span className="border-line text-ink-muted hidden items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-[10px] font-semibold min-[380px]:inline-flex sm:text-[11px]">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="bg-ludo-green absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                                    <span className="bg-ludo-green relative inline-flex h-1.5 w-1.5 rounded-full" />
                                </span>
                                Demo lokal
                            </span>
                            {screen === 'game' && (
                                <button
                                    type="button"
                                    onClick={openSetup}
                                    className="border-line text-ink-muted hover:text-ink inline-flex h-8 items-center gap-1.5 rounded-full border bg-white px-2.5 text-[11px] font-semibold transition"
                                    aria-label="Atur nama dan warna pemain"
                                >
                                    <UsersIcon className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">
                                        Atur pemain
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                {screen === 'setup' ? (
                    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
                        <form
                            onSubmit={startGame}
                            className="border-line/80 shadow-card animate-fade-up w-full max-w-lg rounded-[26px] border bg-white p-4 sm:p-6 [@media(max-height:620px)]:p-3"
                        >
                            <p className="text-brand-ink text-[10px] font-semibold tracking-[0.16em]">
                                SEBELUM BERMAIN
                            </p>
                            <h1 className="text-ink mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl [@media(max-height:620px)]:text-lg">
                                Siapkan nama & warna
                            </h1>
                            <p className="text-ink-muted mt-1 text-[11px] leading-5 sm:text-xs [@media(max-height:620px)]:hidden">
                                Pilih warnamu, tulis nama pemain, lalu mulai.
                                Nama akan tampil di kartu dan area warna papan.
                            </p>

                            <fieldset className="mt-4 [@media(max-height:620px)]:mt-2">
                                <legend className="text-ink text-xs font-semibold">
                                    Pilih warnamu
                                </legend>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {PLAYER_IDS.map((color) => {
                                        const palette =
                                            PLAYER_CONFIG[color].palette;
                                        const selected = humanColor === color;

                                        return (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() =>
                                                    selectColor(color)
                                                }
                                                aria-pressed={selected}
                                                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition [@media(max-height:620px)]:py-1.5 ${
                                                    selected
                                                        ? 'border-transparent'
                                                        : 'border-line hover:border-ink/15 bg-white'
                                                }`}
                                                style={
                                                    selected
                                                        ? {
                                                              background:
                                                                  palette.soft,
                                                              boxShadow: `0 0 0 2px ${palette.base}55`,
                                                          }
                                                        : undefined
                                                }
                                            >
                                                <span
                                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white [@media(max-height:620px)]:h-7 [@media(max-height:620px)]:w-7"
                                                    style={{
                                                        background:
                                                            palette.base,
                                                    }}
                                                >
                                                    {selected ? '✓' : ''}
                                                </span>
                                                <span className="min-w-0">
                                                    <span
                                                        className="block text-xs font-semibold"
                                                        style={{
                                                            color: palette.text,
                                                        }}
                                                    >
                                                        {
                                                            PLAYER_CONFIG[color]
                                                                .label
                                                        }
                                                    </span>
                                                    <span className="text-ink-muted block text-[10px]">
                                                        {selected
                                                            ? 'Kamu'
                                                            : 'Pilih ini'}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2 [@media(max-height:620px)]:grid-cols-2">
                                <label className="block">
                                    <span className="text-ink text-xs font-semibold">
                                        Nama kamu
                                    </span>
                                    <input
                                        value={yourName}
                                        onChange={(event) =>
                                            setYourName(event.target.value)
                                        }
                                        maxLength={16}
                                        autoComplete="off"
                                        placeholder="Nama kamu"
                                        className="border-line text-ink placeholder:text-ink-muted/60 focus:border-brand mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm transition outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-ink text-xs font-semibold">
                                        Nama lawan
                                    </span>
                                    <input
                                        value={opponentName}
                                        onChange={(event) =>
                                            setOpponentName(event.target.value)
                                        }
                                        maxLength={16}
                                        autoComplete="off"
                                        placeholder="Nama lawan"
                                        className="border-line text-ink placeholder:text-ink-muted/60 focus:border-brand mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm transition outline-none"
                                    />
                                </label>
                            </div>

                            <div className="bg-surface-muted mt-3 flex items-center gap-2 rounded-xl px-3 py-2 [@media(max-height:620px)]:hidden">
                                <span className="flex shrink-0 -space-x-1">
                                    <span
                                        className="h-4 w-4 rounded-full border-2 border-white"
                                        style={{
                                            background:
                                                PLAYER_CONFIG[humanColor]
                                                    .palette.base,
                                        }}
                                    />
                                    <span
                                        className="h-4 w-4 rounded-full border-2 border-white"
                                        style={{
                                            background:
                                                PLAYER_CONFIG[setupOpponent]
                                                    .palette.base,
                                        }}
                                    />
                                </span>
                                <p className="text-ink-muted min-w-0 text-[10px] leading-4">
                                    Kamu memakai{' '}
                                    <strong
                                        style={{
                                            color: PLAYER_CONFIG[humanColor]
                                                .palette.text,
                                        }}
                                    >
                                        {PLAYER_CONFIG[humanColor].label}
                                    </strong>
                                    , lawan memakai{' '}
                                    <strong
                                        style={{
                                            color: PLAYER_CONFIG[setupOpponent]
                                                .palette.text,
                                        }}
                                    >
                                        {PLAYER_CONFIG[setupOpponent].label}
                                    </strong>
                                    .
                                </p>
                            </div>

                            <button
                                type="submit"
                                className="bg-brand hover:bg-brand-dark mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.85)] transition active:scale-[0.99] [@media(max-height:620px)]:mt-2 [@media(max-height:620px)]:h-10"
                            >
                                <DiceIcon className="h-4.5 w-4.5" />
                                Mulai bermain
                            </button>

                            <div className="mt-3 flex items-center justify-between gap-2 [@media(max-height:620px)]:mt-2">
                                <Link
                                    href={route('home')}
                                    className="text-ink-muted hover:text-ink text-[11px] font-semibold transition"
                                >
                                    Kembali ke beranda
                                </Link>
                                <span className="text-ink-muted inline-flex items-center gap-1 text-[10px] font-medium">
                                    <SparklesIcon className="h-3 w-3" />
                                    Latihan lokal
                                </span>
                            </div>
                        </form>
                    </main>
                ) : (
                    <main className="mx-auto flex min-h-0 w-full max-w-6xl min-w-0 flex-1 flex-col px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] sm:px-4 sm:pt-3">
                        <div className="grid min-h-0 min-w-0 flex-1 gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_280px] md:gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4">
                            <section className="flex min-h-0 min-w-0 flex-col gap-2">
                                <div className="border-line/80 shadow-card flex shrink-0 items-stretch overflow-hidden rounded-[18px] border bg-white md:hidden [@media(max-height:560px)]:hidden">
                                    <PlayerCard
                                        size="sm"
                                        color={opponentColor}
                                        name={state.names[opponentColor]}
                                        role="Lawan"
                                        subtitle={activeSubtitle(opponentColor)}
                                        active={
                                            state.turn === opponentColor &&
                                            !state.winner
                                        }
                                        finished={finished(opponentColor)}
                                        className="flex-1"
                                    />
                                    <div
                                        className="bg-line/60 w-px shrink-0 self-stretch"
                                        aria-hidden="true"
                                    />
                                    <PlayerCard
                                        size="sm"
                                        color={state.human}
                                        name={state.names[state.human]}
                                        role="Kamu"
                                        subtitle={activeSubtitle(state.human)}
                                        active={
                                            state.turn === state.human &&
                                            !state.winner
                                        }
                                        finished={finished(state.human)}
                                        className="flex-1"
                                    />
                                </div>

                                <div
                                    ref={boardRef}
                                    className="flex min-h-0 min-w-0 flex-1 items-center justify-center"
                                >
                                    {boardSize > 0 && (
                                        <div
                                            className="shrink-0"
                                            style={{
                                                width: boardSize,
                                                height: boardSize,
                                            }}
                                        >
                                            <LudoBoard
                                                tokens={boardTokens}
                                                playerNames={{
                                                    blue: state.names.blue,
                                                    green: state.names.green,
                                                }}
                                                activeColor={
                                                    state.winner
                                                        ? undefined
                                                        : state.turn
                                                }
                                                activeLabel={
                                                    state.winner
                                                        ? undefined
                                                        : turnLabel
                                                }
                                                className="h-full w-full"
                                            />
                                        </div>
                                    )}
                                </div>
                            </section>

                            <aside className="hidden min-h-0 min-w-0 flex-col gap-3 md:flex">
                                <section className="border-line/80 shadow-card shrink-0 rounded-[22px] border bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p
                                                className="text-[10px] font-semibold tracking-[0.16em]"
                                                style={{
                                                    color: PLAYER_CONFIG[
                                                        state.turn
                                                    ].palette.text,
                                                }}
                                            >
                                                {turnLabel}
                                            </p>
                                            <p
                                                className="text-ink mt-1 text-sm leading-5 font-semibold"
                                                aria-live="polite"
                                            >
                                                {instruction}
                                            </p>
                                        </div>
                                        <Dice
                                            value={displayDice}
                                            rolling={state.phase === 'rolling'}
                                            className="h-14 w-14 shrink-0"
                                        />
                                    </div>

                                    {state.winner ? (
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setResultModalOpen(true)
                                                }
                                                className="border-line text-ink hover:bg-surface-muted inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border bg-white px-3 text-xs font-semibold transition"
                                            >
                                                <TrophyIcon className="h-4 w-4" />
                                                Lihat hasil
                                            </button>
                                            <button
                                                type="button"
                                                onClick={playAgain}
                                                className="bg-brand hover:bg-brand-dark inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-semibold text-white transition active:scale-[0.99]"
                                            >
                                                <RefreshIcon className="h-4 w-4" />
                                                Main lagi
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleRoll}
                                                disabled={!canRoll}
                                                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.99] enabled:hover:brightness-90 disabled:cursor-not-allowed"
                                                style={rollButtonStyle}
                                            >
                                                <DiceIcon className="h-4.5 w-4.5" />
                                                {rollLabel}
                                            </button>

                                            <p className="text-ink-muted mt-2 text-center text-[10px] font-medium">
                                                Lempar 6 untuk keluar
                                            </p>
                                        </>
                                    )}
                                </section>

                                <section className="border-line/80 shadow-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border bg-white">
                                    <div className="shrink-0 px-4 pt-3.5 pb-2">
                                        <h2 className="text-brand-ink text-[10px] font-semibold tracking-[0.16em]">
                                            PEMAIN
                                        </h2>
                                    </div>
                                    <PlayerCard
                                        color={opponentColor}
                                        name={state.names[opponentColor]}
                                        role="Lawan"
                                        subtitle={activeSubtitle(opponentColor)}
                                        active={
                                            state.turn === opponentColor &&
                                            !state.winner
                                        }
                                        finished={finished(opponentColor)}
                                        className="min-h-0 flex-1"
                                    />
                                    <div
                                        className="relative mx-4 shrink-0"
                                        aria-hidden="true"
                                    >
                                        <div className="border-line/60 border-t" />
                                        <span className="border-line/80 text-ink absolute top-1/2 left-1/2 grid h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-white text-[9px] font-bold tracking-[0.08em]">
                                            VS
                                        </span>
                                    </div>
                                    <PlayerCard
                                        color={state.human}
                                        name={state.names[state.human]}
                                        role="Kamu"
                                        subtitle={activeSubtitle(state.human)}
                                        active={
                                            state.turn === state.human &&
                                            !state.winner
                                        }
                                        finished={finished(state.human)}
                                        className="min-h-0 flex-1"
                                    />
                                    <div className="border-line/60 mt-auto flex shrink-0 items-center border-t px-4 py-3 [@media(max-height:640px)]:hidden">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-ink-muted text-[9px] font-semibold tracking-[0.12em] uppercase">
                                                Bidakmu keluar
                                            </p>
                                            <p className="text-ink mt-0.5 text-xs font-bold tabular-nums">
                                                {outOfBase(state.human)}/4
                                            </p>
                                        </div>
                                        <div
                                            className="bg-line/60 mx-3 h-7 w-px shrink-0"
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-ink-muted text-[9px] font-semibold tracking-[0.12em] uppercase">
                                                Total langkah
                                            </p>
                                            <p className="text-ink mt-0.5 text-xs font-bold tabular-nums">
                                                {state.totalMoves}
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            </aside>
                        </div>

                        <div className="border-line/80 shadow-card mt-2 shrink-0 rounded-[20px] border bg-white p-2 md:hidden">
                            <div className="flex items-center gap-2">
                                <Dice
                                    value={displayDice}
                                    rolling={state.phase === 'rolling'}
                                    className="h-11 w-11 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <p
                                        className="truncate text-[9px] font-bold tracking-[0.12em]"
                                        style={{
                                            color: PLAYER_CONFIG[state.turn]
                                                .palette.text,
                                        }}
                                    >
                                        {turnLabel}
                                    </p>
                                    <p
                                        className="text-ink truncate text-[11px] font-semibold"
                                        aria-live="polite"
                                    >
                                        {mobileInstruction}
                                    </p>
                                    <p className="text-ink-muted truncate text-[10px]">
                                        {state.log[0]?.text}
                                    </p>
                                </div>
                                {state.winner ? (
                                    <button
                                        type="button"
                                        onClick={() => setResultModalOpen(true)}
                                        className="bg-brand hover:bg-brand-dark inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition active:scale-[0.98]"
                                    >
                                        <TrophyIcon className="h-4 w-4" />
                                        <span>Hasil</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleRoll}
                                        disabled={!canRoll}
                                        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition active:scale-[0.98] enabled:hover:brightness-90 disabled:cursor-not-allowed"
                                        style={rollButtonStyle}
                                    >
                                        <DiceIcon className="h-4 w-4" />
                                        <span>
                                            {state.phase === 'rolling'
                                                ? '…'
                                                : state.phase === 'choosing' &&
                                                    state.turn === state.human
                                                  ? 'Pilih bidak'
                                                  : 'Lempar'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </main>
                )}
            </div>

            {state.winner && screen === 'game' && (
                <MatchResultModal
                    open={resultModalOpen}
                    winner={state.winner}
                    human={state.human}
                    standings={standings}
                    durationSeconds={durationSeconds}
                    totalMoves={state.totalMoves}
                    onPlayAgain={playAgain}
                    onOpenSetup={openSetup}
                    onClose={() => setResultModalOpen(false)}
                />
            )}
        </>
    );
}
