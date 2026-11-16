import ConfirmLeaveModal from '@/Components/Game/ConfirmLeaveModal';
import Dice from '@/Components/Game/Dice';
import FullscreenToggle from '@/Components/Game/FullscreenToggle';
import {
    ChevronLeftIcon,
    CloseIcon,
    DiceIcon,
    HashIcon,
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
    BASE_POSITION,
    boardAbsoluteTrackIndex,
    boardTokenPoint,
    getBoardSpec,
    isBoardSafeIndex,
    PLAYER_CONFIG,
    PlayerColor,
    PlayerCount,
    SEATS_BY_COUNT,
} from '@/lib/ludo';
import {
    isSoundEnabled,
    playCaptureSound,
    playChooseTokenSound,
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
import { useGameExitGuard } from '@/lib/useGameExitGuard';
import { User } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';

type PlayerId = PlayerColor;
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
    order: PlayerId[];
    arms: number;
    tokens: Record<PlayerId, number[]>;
    turn: PlayerId;
    human: PlayerId;
    names: SetupNames;
    phase: Phase;
    dice: number | null;
    legalMoves: LegalMove[];
    winner: PlayerId | null;
    winners: PlayerId[];
    message: string;
    log: LogEntry[];
    logId: number;
    rolls: Record<PlayerId, number>;
    hadSix: Record<PlayerId, boolean>;
    captures: Record<PlayerId, number>;
    totalMoves: number;
    startedAt: number | null;
    finishedAt: number | null;
};

type Action =
    | {
          type: 'RESTORE';
          match: {
              tokens: number[][];
              colors?: PlayerId[];
              arms?: number;
              turn: number;
              dice: number | null;
              winner: number | null;
              winners?: number[];
              stats?: { rolls: number; captures: number }[];
              had_six?: boolean[];
              total_moves?: number;
              started_at?: string | null;
          };
      }
    | {
          type: 'START';
          human: PlayerId;
          names: SetupNames;
          order?: PlayerId[];
          arms?: number;
          now: number;
          turn?: PlayerId;
      }
    | { type: 'ROLL_START'; value: number }
    | { type: 'ROLL_RESULT'; value: number }
    | { type: 'MOVE'; tokenIndex: number; now: number }
    | { type: 'RESET'; now: number; turn?: PlayerId };

const PLAYER_IDS: PlayerId[] = ['blue', 'green'];
const LOCAL_COUNTS: PlayerCount[] = [2, 3, 4, 5, 6, 7];

function createTokenMap(): Record<PlayerId, number[]> {
    return {
        red: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
        yellow: [-1, -1, -1, -1],
        blue: [-1, -1, -1, -1],
        purple: [-1, -1, -1, -1],
        orange: [-1, -1, -1, -1],
        teal: [-1, -1, -1, -1],
    };
}

function createNumberMap(): Record<PlayerId, number> {
    return {
        red: 0,
        green: 0,
        yellow: 0,
        blue: 0,
        purple: 0,
        orange: 0,
        teal: 0,
    };
}

function createBoolMap(): Record<PlayerId, boolean> {
    return {
        red: false,
        green: false,
        yellow: false,
        blue: false,
        purple: false,
        orange: false,
        teal: false,
    };
}

const DEFAULT_NAMES: SetupNames = {
    blue: 'Kamu',
    green: 'Lawan',
    red: 'Merah',
    yellow: 'Kuning',
    purple: 'Ungu',
    orange: 'Oranye',
    teal: 'Toska',
};

const initialState: GameState = {
    order: PLAYER_IDS,
    arms: 4,
    tokens: createTokenMap(),
    turn: 'blue',
    human: 'blue',
    names: DEFAULT_NAMES,
    phase: 'idle',
    dice: null,
    legalMoves: [],
    winner: null,
    winners: [],
    message: 'Giliranmu. Lempar dadu.',
    log: [
        {
            id: 0,
            text: 'Pertandingan latihan dimulai. Biru jalan lebih dulu.',
        },
    ],
    logId: 1,
    rolls: createNumberMap(),
    hadSix: createBoolMap(),
    captures: createNumberMap(),
    totalMoves: 0,
    startedAt: null,
    finishedAt: null,
};

function otherPlayer(player: PlayerId, order: PlayerId[] = PLAYER_IDS): PlayerId {
    return order.find((item) => item !== player) ?? (player === 'blue' ? 'green' : 'blue');
}

function nextActivePlayer(
    order: PlayerId[],
    current: PlayerId,
    winners: PlayerId[],
): PlayerId {
    const startIndex = order.indexOf(current);

    for (let offset = 1; offset <= order.length; offset++) {
        const candidate = order[(startIndex + offset) % order.length];
        if (!winners.includes(candidate)) {
            return candidate;
        }
    }

    return order[(startIndex + 1) % order.length];
}

function randomDie(): number {
    return 1 + Math.floor(Math.random() * 6);
}

function shouldForceOpeningSix(state: GameState, player: PlayerId): boolean {
    const hasTokenOut = state.tokens[player].some(
        (position) => position !== BASE_POSITION,
    );

    return state.rolls[player] === 3 && !state.hadSix[player] && !hasTokenOut;
}

function rollDieForTurn(state: GameState): number {
    if (shouldForceOpeningSix(state, state.turn)) {
        return 6;
    }

    return randomDie();
}

function randomPlayer(order: PlayerId[] = PLAYER_IDS): PlayerId {
    return order[Math.floor(Math.random() * order.length)];
}

function cleanNames(human: PlayerId, names: Partial<SetupNames>): SetupNames {
    return {
        ...DEFAULT_NAMES,
        ...names,
        [human]: names[human]?.trim().slice(0, 16) || 'Pemain',
    } as SetupNames;
}

function createInitialState(
    human: PlayerId,
    rawNames: Partial<SetupNames>,
    now: number,
    startingTurn?: PlayerId,
    order: PlayerId[] = PLAYER_IDS,
    arms?: number,
): GameState {
    const names = cleanNames(human, rawNames);
    const turn = startingTurn ?? human;
    const resolvedArms = arms ?? (order.length >= 5 ? order.length : 4);

    return {
        ...initialState,
        order,
        arms: resolvedArms,
        tokens: createTokenMap(),
        human,
        names,
        turn,
        message:
            turn === human
                ? `${names[human]}, giliranmu. Lempar dadu.`
                : `Giliran ${names[turn]}.`,
        log: [
            {
                id: 0,
                text: `${names[turn]} (${PLAYER_CONFIG[turn].label}) jalan lebih dulu.`,
                color: turn,
            },
        ],
        logId: 1,
        rolls: createNumberMap(),
        hadSix: createBoolMap(),
        captures: createNumberMap(),
        totalMoves: 0,
        startedAt: now,
        finishedAt: null,
        winners: [],
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
    finishPosition: number,
): LegalMove[] {
    return tokens[player].flatMap((position, tokenIndex) => {
        if (position === finishPosition) {
            return [];
        }

        if (position === BASE_POSITION) {
            return roll === 6 ? [{ tokenIndex, target: 0 }] : [];
        }

        const target = position + roll;

        return target <= finishPosition ? [{ tokenIndex, target }] : [];
    });
}

function chooseAiMove(state: GameState): LegalMove | null {
    if (state.legalMoves.length === 0) {
        return null;
    }

    const spec = getBoardSpec(state.order, state.arms);
    const opponents = state.order.filter((color) => color !== state.turn);

    const score = (move: LegalMove) => {
        let value = move.target / 10;
        const from = state.tokens[state.turn][move.tokenIndex];

        if (from === BASE_POSITION) {
            value += 12;
        }

        if (move.target >= spec.firstLanePosition) {
            value += 30;
        }

        if (move.target === spec.finishPosition) {
            value += 60;
        }

        if (move.target <= spec.lastTrackPosition) {
            const absolute = boardAbsoluteTrackIndex(
                spec,
                state.turn,
                move.target,
            );

            if (
                !isBoardSafeIndex(spec, absolute) &&
                opponents.some((opponent) =>
                    state.tokens[opponent].some(
                        (position) =>
                            boardAbsoluteTrackIndex(spec, opponent, position) ===
                            absolute,
                    ),
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
    if (action.type === 'RESTORE') {
        const order = action.match.colors ?? PLAYER_IDS;
        const arms =
            action.match.arms ??
            (order.length >= 5 ? order.length : state.arms);
        const spec = getBoardSpec(order, arms);
        const turn = order[action.match.turn];
        const tokens = createTokenMap();
        const rolls = createNumberMap();
        const hadSix = createBoolMap();
        const captures = createNumberMap();
        order.forEach((color, index) => {
            tokens[color] = action.match.tokens[index] ?? [-1, -1, -1, -1];
            rolls[color] = action.match.stats?.[index]?.rolls ?? 0;
            captures[color] = action.match.stats?.[index]?.captures ?? 0;
            hadSix[color] =
                action.match.had_six?.[index] ??
                tokens[color].some((position) => position !== BASE_POSITION);
        });
        const winners: PlayerId[] = Array.isArray(action.match.winners)
            ? action.match.winners
                  .map((idx) => order[idx])
                  .filter((color): color is PlayerId => Boolean(color))
            : order.filter((color) =>
                  tokens[color].every((pos) => pos === spec.finishPosition),
              );
        const winner =
            action.match.winner === null
                ? winners.length >= order.length
                    ? (winners[0] ?? null)
                    : null
                : (order[action.match.winner] ?? null);
        const dice = action.match.dice;
        const moves =
            dice === null
                ? []
                : computeLegalMoves(tokens, turn, dice, spec.finishPosition);
        const mine = turn === state.human;
        const restoredAt = action.match.started_at
            ? Date.parse(action.match.started_at)
            : state.startedAt;

        return {
            ...state,
            order,
            arms: spec.arms,
            tokens,
            turn,
            dice,
            winner,
            winners,
            phase: winner ? 'gameover' : dice === null ? 'idle' : 'choosing',
            legalMoves: moves,
            rolls,
            hadSix,
            captures,
            totalMoves: action.match.total_moves ?? state.totalMoves,
            startedAt: Number.isNaN(restoredAt) ? state.startedAt : restoredAt,
            ...appendLog(
                state,
                'Pertandingan dilanjutkan dari status terakhir.',
            ),
            message: winner
                ? `${state.names[winner]} memenangkan pertandingan.`
                : dice !== null
                  ? mine
                      ? 'Lanjutkan: pilih bidak yang menyala untuk digerakkan.'
                      : `Menunggu ${state.names[turn]} memilih langkah.`
                  : mine
                    ? 'Giliranmu. Lempar dadu.'
                    : `Giliran ${state.names[turn]}.`,
        };
    }
    if (action.type === 'START') {
        return createInitialState(
            action.human,
            action.names,
            action.now,
            action.turn,
            action.order,
            action.arms,
        );
    }

    if (action.type === 'RESET') {
        return createInitialState(
            state.human,
            state.names,
            action.now,
            action.turn,
            state.order,
            state.arms,
        );
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
            hadSix: {
                ...state.hadSix,
                [state.turn]: state.hadSix[state.turn] || action.value === 6,
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

        const spec = getBoardSpec(state.order, state.arms);
        const legalMoves = computeLegalMoves(
            state.tokens,
            state.turn,
            action.value,
            spec.finishPosition,
        );
        const actor = state.names[state.turn];
        const logged = appendLog(
            state,
            `${actor} melempar ${action.value}.`,
            state.turn,
        );

        if (legalMoves.length === 0) {
            const nextPlayer = nextActivePlayer(
                state.order,
                state.turn,
                state.winners,
            );

            return {
                ...state,
                ...logged,
                dice: action.value,
                legalMoves: [],
                phase: 'idle',
                turn: nextPlayer,
                message:
                    state.turn === state.human
                        ? `Tidak ada langkah. Giliran ${state.names[nextPlayer]}.`
                        : `${actor} tidak punya langkah. Giliran ${state.names[nextPlayer]}.`,
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

        const spec = getBoardSpec(state.order, state.arms);
        const actor = state.turn;
        const actorName = state.names[actor];
        const from = state.tokens[actor][move.tokenIndex];
        const nextTokens: Record<PlayerId, number[]> = {
            ...state.tokens,
            [actor]: [...state.tokens[actor]],
        };

        nextTokens[actor][move.tokenIndex] = move.target;

        let capturedCount = 0;

        if (move.target <= spec.lastTrackPosition) {
            const absolute = boardAbsoluteTrackIndex(spec, actor, move.target);

            if (!isBoardSafeIndex(spec, absolute)) {
                state.order
                    .filter((color) => color !== actor)
                    .forEach((color) => {
                        nextTokens[color] = nextTokens[color].map(
                            (position) => {
                                if (
                                    boardAbsoluteTrackIndex(
                                        spec,
                                        color,
                                        position,
                                    ) === absolute
                                ) {
                                    capturedCount += 1;

                                    return BASE_POSITION;
                                }

                                return position;
                            },
                        );
                    });
            }
        }

        const captured = capturedCount > 0;
        const reachedHome = move.target === spec.finishPosition;
        const playerFinished = nextTokens[actor].every(
            (position) => position === spec.finishPosition,
        );
        const nextWinners =
            playerFinished && !state.winners.includes(actor)
                ? [...state.winners, actor]
                : state.winners;
        const allWon = nextWinners.length >= state.order.length;
        const nextPlayer = nextActivePlayer(state.order, actor, nextWinners);
        const extraTurn =
            !playerFinished && (state.dice === 6 || captured || reachedHome);
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
        const finishRank = playerFinished ? nextWinners.length : null;
        const logText =
            finishRank !== null
                ? `${actorName} menyelesaikan semua bidak (Juara ${finishRank})!`
                : `${actorName} ${moveDescription}${extraDescription}.`;
        const logged = appendLog(state, logText, actor);

        if (allWon) {
            const firstWinner = nextWinners[0];
            const firstWinnerName = state.names[firstWinner];

            return {
                ...state,
                ...logged,
                tokens: nextTokens,
                legalMoves: [],
                phase: 'gameover',
                winner: firstWinner,
                winners: nextWinners,
                captures: nextCaptures,
                totalMoves: nextTotalMoves,
                finishedAt: action.now,
                message:
                    firstWinner === state.human
                        ? `Semua pemain selesai. ${firstWinnerName} juara 1!`
                        : `Semua pemain selesai. ${firstWinnerName} memenangkan pertandingan.`,
            };
        }

        if (playerFinished) {
            return {
                ...state,
                ...logged,
                tokens: nextTokens,
                legalMoves: [],
                phase: 'idle',
                turn: nextPlayer,
                winners: nextWinners,
                captures: nextCaptures,
                totalMoves: nextTotalMoves,
                message:
                    nextPlayer === state.human
                        ? `${actorName} finis #${finishRank}! Giliranmu.`
                        : `${actorName} finis #${finishRank}! Giliran ${state.names[nextPlayer]}.`,
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
                winners: nextWinners,
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
            turn: nextPlayer,
            winners: nextWinners,
            captures: nextCaptures,
            totalMoves: nextTotalMoves,
            message:
                nextPlayer === state.human
                    ? 'Giliranmu. Lempar dadu.'
                    : `Giliran ${state.names[nextPlayer]}.`,
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
    const { auth, room, me, roomNotice } = usePage().props as unknown as {
        auth?: { user: User | null };
        room?: {
            code: string;
            max_players: number;
            status: string;
            starting_player_id?: number | null;
            started_at?: string | null;
            match_state?: {
                tokens: number[][];
                colors?: PlayerId[];
                arms?: number;
                turn: number;
                dice: number | null;
                winner: number | null;
                winners?: number[];
                stats?: { rolls: number; captures: number }[];
                had_six?: boolean[];
                total_moves?: number;
            } | null;
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
            is_host: boolean;
        } | null;
        roomNotice?: string | null;
    };
    const accountName = me?.name ?? auth?.user?.name?.split(' ')[0] ?? 'Pemain';
    const roomOrder =
        room?.match_state?.colors ??
        (room ? (['blue', 'green'] as PlayerId[]) : PLAYER_IDS);
    const roomArms =
        room?.match_state?.arms ??
        (room && room.max_players >= 5 ? room.max_players : 4);
    const myRoomIndex =
        room?.players.findIndex((player) => player.id === me?.id) ?? -1;
    const myRoomColor: PlayerId = roomOrder[myRoomIndex] ?? 'blue';
    const roomOtherPlayer = room?.players.find((p) => p.id !== me?.id);

    const [screen, setScreen] = useState<Screen>(room ? 'game' : 'setup');
    const [setupCount, setSetupCount] = useState<PlayerCount>(2);
    const [humanColor, setHumanColor] = useState<PlayerId>('blue');
    const [yourName, setYourName] = useState(accountName);
    const [opponentName, setOpponentName] = useState(
        roomOtherPlayer?.name ?? 'Lawan',
    );
    const [state, dispatch] = useReducer(reducer, initialState);
    const [movingToken, setMovingToken] = useState<MovingToken | null>(null);
    const [returningTokens, setReturningTokens] = useState<MovingToken[]>([]);
    const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [endGameModalOpen, setEndGameModalOpen] = useState(false);
    const [endingGame, setEndingGame] = useState(false);
    const [boardRef, boardSize] = useBoardSize(screen === 'game');
    const movingRef = useRef(false);
    const previousTurnRef = useRef<PlayerId | null>(null);
    const rollPendingRef = useRef(false);
    const seenActionsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!room || !me) {
            return;
        }

        const initialTurn: PlayerId =
            roomOrder[
                room.players.findIndex(
                    (player) => player.id === room.starting_player_id,
                )
            ] ?? roomOrder[0];
        const names = { ...initialState.names };
        room.players.forEach((player, index) => {
            if (roomOrder[index]) names[roomOrder[index]] = player.name;
        });

        previousTurnRef.current = initialTurn;
        dispatch({
            type: 'START',
            human: myRoomColor,
            turn: initialTurn,
            names,
            order: roomOrder,
            arms: roomArms,
            now: Date.now(),
        });
        if (room.match_state) {
            dispatch({
                type: 'RESTORE',
                match: {
                    ...room.match_state,
                    started_at: room.started_at ?? null,
                },
            });
        }
        setScreen('game');
    }, [room?.code]);

    const activeSpec = useMemo(
        () => getBoardSpec(state.order, state.arms),
        [state.order, state.arms],
    );
    const setupColors: PlayerId[] =
        setupCount === 2 ? PLAYER_IDS : SEATS_BY_COUNT[setupCount];
    const opponentColor = otherPlayer(state.human, state.order);
    const blockedByRoom = Boolean(room) && !me;
    const serverWinner = room?.match_state?.winner ?? null;
    const matchRunning =
        Boolean(room) &&
        Boolean(me) &&
        screen === 'game' &&
        serverWinner === null &&
        !state.winner;
    const exitGuard = useGameExitGuard(
        matchRunning,
        route('home'),
        `play:${room?.code ?? 'solo'}`,
    );
    const canRoll =
        (!room || myRoomIndex >= 0) &&
        state.turn === state.human &&
        state.phase === 'idle' &&
        !state.winner &&
        !state.winners.includes(state.human);
    const displayDice = state.dice ?? 6;
    const setupOpponent = otherPlayer(humanColor, setupColors);

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
                computeLegalMoves(
                    state.tokens,
                    state.turn,
                    value,
                    activeSpec.finishPosition,
                ).length > 0;

            dispatch({ type: 'ROLL_RESULT', value });

            if (!hasMoves) {
                playNoMoveSound();
            }
        }, 1080);

        return () => window.clearTimeout(timeout);
    }, [
        state.phase,
        state.dice,
        state.tokens,
        state.turn,
        activeSpec.finishPosition,
    ]);

    useEffect(() => {
        const previous = previousTurnRef.current;

        previousTurnRef.current = state.turn;

        if (previous === null || previous === state.turn || state.winner) {
            return;
        }

        playTurnSound(state.turn === state.human);
    }, [state.turn, state.human, state.winner]);

    useEffect(() => {
        if (
            state.phase === 'choosing' &&
            state.turn === state.human &&
            state.legalMoves.length > 1 &&
            !state.winner
        ) {
            playChooseTokenSound();
        }
    }, [
        state.phase,
        state.turn,
        state.human,
        state.legalMoves.length,
        state.winner,
    ]);

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
        if (room) {
            return;
        }

        if (
            state.turn === state.human ||
            state.phase !== 'idle' ||
            state.winner
        ) {
            return;
        }

        const timeout = window.setTimeout(() => {
            dispatch({ type: 'ROLL_START', value: rollDieForTurn(state) });
        }, 900);

        return () => window.clearTimeout(timeout);
    }, [room, state]);

    const animateMove = useCallback(
        async (tokenIndex: number, fromRemote = false) => {
            if (movingRef.current || state.phase !== 'choosing') {
                return;
            }

            if (room && !fromRemote && state.turn !== state.human) {
                return;
            }

            const move = state.legalMoves.find(
                (candidate) => candidate.tokenIndex === tokenIndex,
            );

            if (!move) {
                return;
            }

            if (room && !fromRemote) {
                const csrf =
                    document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute('content') ?? '';
                void fetch(route('rooms.match.move', { code: room.code }), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrf,
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({ token_index: tokenIndex }),
                })
                    .then((response) => {
                        if (
                            response.status === 419 ||
                            response.status === 401
                        ) {
                            // The session expired mid-match. Reloading rebinds
                            // this browser to its saved seat and restores the
                            // latest board from the server.
                            window.location.reload();
                        }
                    })
                    .catch(() => undefined);
            }

            const color = state.turn;
            const opponents = state.order.filter((item) => item !== color);
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

            const capturedTargets: {
                color: PlayerId;
                tokenIndex: number;
                fromPosition: number;
            }[] = [];

            if (move.target <= activeSpec.lastTrackPosition) {
                const absolute = boardAbsoluteTrackIndex(
                    activeSpec,
                    color,
                    move.target,
                );

                if (!isBoardSafeIndex(activeSpec, absolute)) {
                    opponents.forEach((opponent) =>
                        state.tokens[opponent].forEach(
                            (position, opponentTokenIndex) => {
                                if (
                                    position >= 0 &&
                                    position <= activeSpec.lastTrackPosition &&
                                    boardAbsoluteTrackIndex(
                                        activeSpec,
                                        opponent,
                                        position,
                                    ) === absolute
                                ) {
                                    capturedTargets.push({
                                        color: opponent,
                                        tokenIndex: opponentTokenIndex,
                                        fromPosition: position,
                                    });
                                }
                            },
                        ),
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

            if (capturedTargets.length > 0) {
                playCaptureSound();

                const reducedMotion = window.matchMedia(
                    '(prefers-reduced-motion: reduce)',
                ).matches;

                if (!reducedMotion) {
                    const maxPos = Math.max(
                        ...capturedTargets.map((item) => item.fromPosition),
                    );
                    const stepDelay = Math.max(
                        26,
                        Math.min(
                            55,
                            Math.floor(1400 / Math.max(1, maxPos + 1)),
                        ),
                    );

                    for (let pos = maxPos; pos >= 0; pos--) {
                        setReturningTokens(
                            capturedTargets.map((item) => ({
                                color: item.color,
                                tokenIndex: item.tokenIndex,
                                position: Math.min(item.fromPosition, pos),
                            })),
                        );
                        await new Promise((resolve) =>
                            window.setTimeout(resolve, stepDelay),
                        );
                    }

                    setReturningTokens(
                        capturedTargets.map((item) => ({
                            color: item.color,
                            tokenIndex: item.tokenIndex,
                            position: BASE_POSITION,
                        })),
                    );
                    await new Promise((resolve) =>
                        window.setTimeout(resolve, 140),
                    );
                }
            } else if (move.target === activeSpec.finishPosition) {
                playFinishSound();
            }

            dispatch({ type: 'MOVE', tokenIndex, now: Date.now() });
            setMovingToken(null);
            setReturningTokens([]);
            movingRef.current = false;
        },
        [
            room,
            activeSpec,
            state.phase,
            state.legalMoves,
            state.tokens,
            state.order,
            state.turn,
            state.human,
        ],
    );

    const animateMoveRef = useRef(animateMove);
    animateMoveRef.current = animateMove;
    const stateTurnRef = useRef(state.turn);
    stateTurnRef.current = state.turn;

    useEffect(() => {
        if (!room?.code || !echoIsConfigured()) {
            return;
        }

        const channelName = `room.${room.code}`;
        const channel = echo().channel(channelName);

        channel.listen(
            '.match.action',
            (payload: {
                action?: {
                    action_id?: string;
                    type?: 'roll' | 'move' | 'end';
                    player_id?: number;
                    value?: number;
                    token_index?: number;
                };
            }) => {
                const action = payload?.action;
                if (!action) {
                    return;
                }

                if (action.action_id) {
                    if (seenActionsRef.current.has(action.action_id)) {
                        return;
                    }
                    seenActionsRef.current.add(action.action_id);
                }

                if (action.type === 'end') {
                    router.visit(route('home'));
                    return;
                }

                const expectedPlayerId =
                    room.players[roomOrder.indexOf(stateTurnRef.current)]?.id;

                if (
                    expectedPlayerId !== undefined &&
                    action.player_id !== expectedPlayerId
                ) {
                    return;
                }

                if (
                    action.type === 'roll' &&
                    typeof action.value === 'number'
                ) {
                    void unlockAudio();
                    dispatch({ type: 'ROLL_START', value: action.value });
                    return;
                }

                if (
                    action.type === 'move' &&
                    typeof action.token_index === 'number' &&
                    action.player_id !== me?.id
                ) {
                    void animateMoveRef.current(action.token_index, true);
                }
            },
        );

        return () => {
            echo().leave(channelName);
        };
    }, [room?.code, me?.id]);

    useEffect(() => {
        if (!endGameModalOpen) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !endingGame) {
                setEndGameModalOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [endGameModalOpen, endingGame]);

    useEffect(() => {
        if (
            state.phase !== 'choosing' ||
            state.legalMoves.length === 0 ||
            state.winner
        ) {
            return;
        }

        if (room && state.turn !== state.human) {
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
        return state.order.flatMap((color) =>
            state.tokens[color].map((position, tokenIndex) => {
                const returning = returningTokens.find(
                    (item) =>
                        item.color === color && item.tokenIndex === tokenIndex,
                );
                const isMoving =
                    movingToken?.color === color &&
                    movingToken.tokenIndex === tokenIndex;
                const isReturning = Boolean(returning);
                const displayPosition = isMoving
                    ? movingToken.position
                    : returning
                      ? returning.position
                      : position;
                const move =
                    state.turn === color && state.phase === 'choosing'
                        ? state.legalMoves.find(
                              (candidate) =>
                                  candidate.tokenIndex === tokenIndex,
                          )
                        : undefined;

                const canClickMove =
                    Boolean(move) &&
                    !movingToken &&
                    returningTokens.length === 0 &&
                    state.turn === state.human;

                return {
                    id: `${color}-${tokenIndex}`,
                    color,
                    point: boardTokenPoint(
                        activeSpec,
                        color,
                        displayPosition,
                        tokenIndex,
                    ),
                    legal: canClickMove,
                    moving: isMoving,
                    returning: isReturning,
                    onClick: canClickMove
                        ? () => {
                              void animateMove(tokenIndex);
                          }
                        : undefined,
                    label: `${state.names[color]} bidak ${tokenIndex + 1}`,
                };
            }),
        );
    }, [
        activeSpec,
        state.tokens,
        state.order,
        state.turn,
        state.phase,
        state.legalMoves,
        state.names,
        state.human,
        room,
        movingToken,
        returningTokens,
        animateMove,
    ]);

    const finished = (color: PlayerId) =>
        state.tokens[color].filter(
            (position) => position === activeSpec.finishPosition,
        ).length;

    const outOfBase = (color: PlayerId) =>
        state.tokens[color].filter((position) => position !== BASE_POSITION)
            .length;

    const standings = useMemo<MatchStanding[]>(() => {
        if (!state.winner) {
            return [];
        }

        const finishedCount = (color: PlayerId) =>
            state.tokens[color].filter(
                (position) => position === activeSpec.finishPosition,
            ).length;

        return [...state.order]
            .sort((a, b) => {
                const rankA = state.winners.indexOf(a);
                const rankB = state.winners.indexOf(b);

                if (rankA !== -1 && rankB !== -1) {
                    return rankA - rankB;
                }
                if (rankA !== -1) {
                    return -1;
                }
                if (rankB !== -1) {
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
        activeSpec.finishPosition,
        state.winner,
        state.winners,
        state.order,
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
        const winRank = state.winners.indexOf(color);

        if (state.winner) {
            return winRank !== -1
                ? `Juara ${winRank + 1}`
                : state.winner === color
                  ? 'Pemenang pertandingan'
                  : 'Pertandingan selesai';
        }

        if (winRank !== -1) {
            return `Selesai · Juara ${winRank + 1}`;
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
              : state.turn !== state.human
                ? `Giliran ${state.names[state.turn]}`
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

    const handleRoll = async () => {
        if (!canRoll) {
            return;
        }

        void unlockAudio();

        if (!room) {
            dispatch({ type: 'ROLL_START', value: rollDieForTurn(state) });
            return;
        }

        if (rollPendingRef.current) {
            return;
        }

        rollPendingRef.current = true;
        try {
            const csrf =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            const response = await fetch(
                route('rooms.match.roll', { code: room.code }),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrf,
                        Accept: 'application/json',
                    },
                },
            );

            if (response.status === 419 || response.status === 401) {
                // Session expired while the tab sat idle; reload to resume the
                // saved seat instead of losing the match.
                window.location.reload();

                return;
            }

            if (response.ok) {
                const data = (await response.json()) as {
                    action?: { action_id?: string; value?: number };
                };
                const action = data?.action;
                if (
                    action?.action_id &&
                    !seenActionsRef.current.has(action.action_id)
                ) {
                    seenActionsRef.current.add(action.action_id);
                    if (typeof action.value === 'number') {
                        dispatch({ type: 'ROLL_START', value: action.value });
                    }
                }
            }
        } finally {
            rollPendingRef.current = false;
        }
    };

    const handleConfirmEndGame = () => {
        if (!room || !me?.is_host || endingGame) {
            return;
        }
        cue(playUiSound);
        setEndingGame(true);
        router.post(
            route('rooms.end', { code: room.code }),
            {},
            {
                onFinish: () => {
                    setEndingGame(false);
                    setEndGameModalOpen(false);
                },
            },
        );
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

    const selectSetupCount = (count: PlayerCount) => {
        setSetupCount(count);
        const nextColors = count === 2 ? PLAYER_IDS : SEATS_BY_COUNT[count];
        if (!nextColors.includes(humanColor)) {
            setHumanColor(nextColors[0]);
        }
        cue(playUiSound);
    };

    const selectColor = (color: PlayerId) => {
        setHumanColor(color);
        cue(playUiSound);
    };

    const startGame = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const order = setupColors;
        const arms = setupCount >= 5 ? setupCount : 4;
        const names = { ...DEFAULT_NAMES } as SetupNames;
        order.forEach((color) => {
            if (color === humanColor) {
                names[color] = yourName;
            } else if (setupCount === 2) {
                names[color] = opponentName;
            } else {
                names[color] = `Bot ${PLAYER_CONFIG[color].label}`;
            }
        });

        const starter = randomPlayer(order);

        cue(playStartSound);
        previousTurnRef.current = starter;
        dispatch({
            type: 'START',
            human: humanColor,
            turn: starter,
            names,
            order,
            arms,
            now: Date.now(),
        });
        setMovingToken(null);
        setReturningTokens([]);
        movingRef.current = false;
        setScreen('game');
    };

    const openSetup = () => {
        cue(playUiSound);
        const count = Math.min(
            7,
            Math.max(2, state.order.length),
        ) as PlayerCount;
        setSetupCount(count);
        setHumanColor(state.human);
        setYourName(state.names[state.human]);
        setOpponentName(state.names[opponentColor]);
        setScreen('setup');
    };

    const playAgain = () => {
        const starter = randomPlayer(state.order);

        cue(playStartSound);
        previousTurnRef.current = starter;
        setMovingToken(null);
        setReturningTokens([]);
        movingRef.current = false;
        dispatch({ type: 'RESET', turn: starter, now: Date.now() });
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
                                onClick={exitGuard.blockLink}
                                aria-label="Kembali ke beranda"
                                className="border-line text-ink-muted hover:text-ink grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-white shadow-sm transition"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Link>
                            <Link
                                href={route('home')}
                                onClick={exitGuard.blockLink}
                                className="rounded-lg"
                            >
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
                            {screen === 'game' && !blockedByRoom && (
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
                            {room && me?.is_host && screen === 'game' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        cue(playUiSound);
                                        setEndGameModalOpen(true);
                                    }}
                                    className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold tracking-wide uppercase transition"
                                >
                                    End Game
                                </button>
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
                            <FullscreenToggle />
                            {!room && (
                                <span className="border-line text-ink-muted hidden items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-[10px] font-semibold min-[380px]:inline-flex sm:text-[11px]">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="bg-ludo-green absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                                        <span className="bg-ludo-green relative inline-flex h-1.5 w-1.5 rounded-full" />
                                    </span>
                                    Demo lokal
                                </span>
                            )}
                            {screen === 'game' && !blockedByRoom && (
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

                {blockedByRoom || (roomNotice && !room) ? (
                    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
                        <div className="animate-modal-enter border-line shadow-card w-full max-w-md rounded-[24px] border bg-white p-5 sm:p-7">
                            <div className="flex items-center gap-3">
                                <span className="bg-brand/10 text-brand-ink grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                                    <HashIcon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                    <h1 className="text-ink text-lg font-semibold tracking-tight">
                                        {room
                                            ? 'Kamu belum duduk di ruang ini'
                                            : 'Ruang tidak ditemukan'}
                                    </h1>
                                    <p className="text-ink-muted text-xs">
                                        {room
                                            ? `Ruang ${room.code}`
                                            : 'Periksa kembali tautan ruangmu.'}
                                    </p>
                                </div>
                            </div>

                            <p
                                role="alert"
                                className="bg-surface-muted text-ink-muted mt-4 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
                            >
                                {roomNotice ??
                                    'Kursi di ruang ini terikat ke browser yang ikut bergabung. Buka tautan ruang dari browser yang sama, atau minta host membagikan kode undangan lagi.'}
                            </p>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                <Link
                                    href={route('home')}
                                    className="border-line text-ink hover:bg-surface-muted inline-flex h-11 flex-1 items-center justify-center rounded-xl border bg-white text-xs font-semibold transition"
                                >
                                    Kembali ke beranda
                                </Link>
                                {room ? (
                                    <Link
                                        href={`${route('room')}?code=${room.code}`}
                                        className="bg-brand hover:bg-brand-dark inline-flex h-11 flex-1 items-center justify-center rounded-xl text-xs font-semibold text-white transition"
                                    >
                                        Masuk ke ruang
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </main>
                ) : screen === 'setup' ? (
                    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
                        <form
                            onSubmit={startGame}
                            className="border-line/80 shadow-card animate-fade-up max-h-[calc(100dvh-72px)] w-full max-w-lg overflow-y-auto rounded-[26px] border bg-white p-4 sm:p-6 [@media(max-height:620px)]:p-3"
                        >
                            <p className="text-brand-ink text-[10px] font-semibold tracking-[0.16em]">
                                SEBELUM BERMAIN
                            </p>
                            <h1 className="text-ink mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl [@media(max-height:620px)]:text-lg">
                                Siapkan nama & warna
                            </h1>
                            <p className="text-ink-muted mt-1 text-[11px] leading-5 sm:text-xs [@media(max-height:620px)]:hidden">
                                Pilih jumlah pemain, warna, dan namamu. Papan
                                menyesuaikan otomatis untuk 2–7 pemain.
                            </p>

                            <fieldset className="mt-3 [@media(max-height:620px)]:mt-2">
                                <legend className="text-ink text-xs font-semibold">
                                    Jumlah pemain
                                </legend>
                                <div className="border-line bg-canvas mt-1.5 grid grid-cols-6 gap-1 rounded-xl border p-1">
                                    {LOCAL_COUNTS.map((count) => {
                                        const selected = setupCount === count;

                                        return (
                                            <button
                                                key={count}
                                                type="button"
                                                onClick={() =>
                                                    selectSetupCount(count)
                                                }
                                                aria-pressed={selected}
                                                className={`h-9 rounded-lg text-xs font-semibold transition ${
                                                    selected
                                                        ? 'text-ink bg-white shadow-sm'
                                                        : 'text-ink-muted hover:text-ink'
                                                }`}
                                            >
                                                {count}P
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            <fieldset className="mt-3 [@media(max-height:620px)]:mt-2">
                                <legend className="text-ink text-xs font-semibold">
                                    Pilih warnamu
                                </legend>
                                <div
                                    className={`mt-2 grid gap-1.5 sm:gap-2 ${
                                        setupColors.length >= 5
                                            ? 'grid-cols-3 sm:grid-cols-4'
                                            : setupColors.length >= 3
                                              ? 'grid-cols-2 sm:grid-cols-4'
                                              : 'grid-cols-2'
                                    }`}
                                >
                                    {setupColors.map((color) => {
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
                                                className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition [@media(max-height:620px)]:py-1.5 ${
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
                                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                                                    style={{
                                                        background:
                                                            palette.base,
                                                    }}
                                                >
                                                    {selected ? '✓' : ''}
                                                </span>
                                                <span className="min-w-0">
                                                    <span
                                                        className="block truncate text-xs font-semibold"
                                                        style={{
                                                            color: palette.text,
                                                        }}
                                                    >
                                                        {
                                                            PLAYER_CONFIG[color]
                                                                .label
                                                        }
                                                    </span>
                                                    <span className="text-ink-muted block truncate text-[10px]">
                                                        {selected
                                                            ? 'Kamu'
                                                            : 'Pilih'}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            <div
                                className={`mt-3 grid gap-2 ${
                                    setupCount === 2
                                        ? 'sm:grid-cols-2 [@media(max-height:620px)]:grid-cols-2'
                                        : ''
                                }`}
                            >
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
                                {setupCount === 2 && (
                                    <label className="block">
                                        <span className="text-ink text-xs font-semibold">
                                            Nama lawan
                                        </span>
                                        <input
                                            value={opponentName}
                                            onChange={(event) =>
                                                setOpponentName(
                                                    event.target.value,
                                                )
                                            }
                                            maxLength={16}
                                            autoComplete="off"
                                            placeholder="Nama lawan"
                                            className="border-line text-ink placeholder:text-ink-muted/60 focus:border-brand mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm transition outline-none"
                                        />
                                    </label>
                                )}
                            </div>

                            <div className="bg-surface-muted mt-3 flex items-center gap-2 rounded-xl px-3 py-2 [@media(max-height:620px)]:hidden">
                                <span className="flex shrink-0 -space-x-1">
                                    {setupColors.map((color) => (
                                        <span
                                            key={color}
                                            className="h-4 w-4 rounded-full border-2 border-white"
                                            style={{
                                                background:
                                                    PLAYER_CONFIG[color].palette
                                                        .base,
                                            }}
                                        />
                                    ))}
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
                                    {setupCount === 2 ? (
                                        <>
                                            , lawan memakai{' '}
                                            <strong
                                                style={{
                                                    color: PLAYER_CONFIG[
                                                        setupOpponent
                                                    ].palette.text,
                                                }}
                                            >
                                                {
                                                    PLAYER_CONFIG[setupOpponent]
                                                        .label
                                                }
                                            </strong>
                                            .
                                        </>
                                    ) : (
                                        <>
                                            {' '}
                                            melawan {setupCount - 1} bot di
                                            papan{' '}
                                            {setupCount >= 5
                                                ? `${setupCount} sisi`
                                                : '4 sisi'}
                                            .
                                        </>
                                    )}
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
                                {state.order.length >= 5 ? (
                                    <div
                                        className={`border-line/80 shadow-card grid shrink-0 gap-1 overflow-hidden rounded-[16px] border bg-white p-1 md:hidden ${
                                            state.order.length === 7
                                                ? 'grid-cols-4'
                                                : 'grid-cols-3'
                                        }`}
                                    >
                                        {state.order.map((color) => {
                                            const palette =
                                                PLAYER_CONFIG[color].palette;
                                            const isTurn =
                                                state.turn === color &&
                                                !state.winner;
                                            const winRank =
                                                state.winners.indexOf(color);

                                            return (
                                                <div
                                                    key={color}
                                                    className="flex min-w-0 items-center gap-1.5 rounded-xl px-1.5 py-1 transition-colors"
                                                    style={
                                                        isTurn
                                                            ? {
                                                                  background:
                                                                      palette.soft,
                                                                  boxShadow: `inset 0 0 0 1.5px ${palette.base}`,
                                                              }
                                                            : undefined
                                                    }
                                                >
                                                    <span
                                                        className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
                                                        style={{
                                                            background:
                                                                palette.base,
                                                        }}
                                                    >
                                                        {state.names[color]
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </span>
                                                    <span className="text-ink min-w-0 flex-1 truncate text-[10px] font-semibold">
                                                        {state.names[color]}
                                                    </span>
                                                    <span
                                                        className="shrink-0 text-[9px] font-bold tabular-nums"
                                                        style={{
                                                            color: palette.text,
                                                        }}
                                                    >
                                                        {winRank !== -1
                                                            ? `#${winRank + 1}`
                                                            : `${finished(color)}/4`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="border-line/80 shadow-card grid shrink-0 grid-cols-2 items-stretch rounded-[18px] border bg-white md:hidden">
                                        {state.order.map((color) => (
                                            <PlayerCard
                                                key={color}
                                                size="sm"
                                                color={color}
                                                name={state.names[color]}
                                                role={
                                                    color === state.human
                                                        ? 'Kamu'
                                                        : 'Lawan'
                                                }
                                                subtitle={activeSubtitle(color)}
                                                active={
                                                    state.turn === color &&
                                                    !state.winner
                                                }
                                                finished={finished(color)}
                                                className="min-w-0 flex-1"
                                            />
                                        ))}
                                    </div>
                                )}

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
                                                order={state.order}
                                                arms={state.arms}
                                                playerNames={Object.fromEntries(
                                                    state.order.map((color) => [
                                                        color,
                                                        state.names[color],
                                                    ]),
                                                )}
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
                                            PEMAIN ({state.order.length})
                                        </h2>
                                    </div>
                                    <div
                                        className={`flex min-h-0 flex-1 flex-col ${
                                            state.order.length >= 5
                                                ? 'divide-line/50 divide-y overflow-y-auto'
                                                : ''
                                        }`}
                                    >
                                        {state.order.map((color) => (
                                            <PlayerCard
                                                key={color}
                                                size={
                                                    state.order.length >= 5
                                                        ? 'sm'
                                                        : 'md'
                                                }
                                                color={color}
                                                name={state.names[color]}
                                                role={
                                                    color === state.human
                                                        ? 'Kamu'
                                                        : 'Lawan'
                                                }
                                                subtitle={activeSubtitle(color)}
                                                active={
                                                    state.turn === color &&
                                                    !state.winner
                                                }
                                                finished={finished(color)}
                                                className={
                                                    state.order.length >= 5
                                                        ? 'shrink-0'
                                                        : 'min-h-0 flex-1'
                                                }
                                            />
                                        ))}
                                    </div>
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
                                                  : state.turn !== state.human
                                                    ? 'Menunggu'
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

            {endGameModalOpen && room && me?.is_host && (
                <div
                    className="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[3px]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="end-game-title"
                    onClick={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !endingGame
                        ) {
                            setEndGameModalOpen(false);
                        }
                    }}
                >
                    <div className="animate-modal-enter border-line w-full max-w-sm rounded-[24px] border bg-white p-5 shadow-[0_24px_64px_-16px_rgba(32,43,58,0.3)]">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2
                                    id="end-game-title"
                                    className="text-ink text-base font-semibold"
                                >
                                    Akhiri permainan?
                                </h2>
                                <p className="text-ink-muted mt-1 text-xs leading-relaxed">
                                    Pertandingan di ruang {room.code} akan
                                    dihentikan untuk semua pemain dan kamu akan
                                    kembali ke beranda.
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={endingGame}
                                onClick={() => setEndGameModalOpen(false)}
                                aria-label="Tutup konfirmasi"
                                className="border-line text-ink-muted hover:bg-surface-muted hover:text-ink grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-white transition"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-5 flex items-center gap-2">
                            <button
                                type="button"
                                disabled={endingGame}
                                onClick={() => setEndGameModalOpen(false)}
                                className="border-line text-ink hover:bg-surface-muted inline-flex h-10 flex-1 items-center justify-center rounded-xl border bg-white text-xs font-semibold transition"
                            >
                                Lanjut main
                            </button>
                            <button
                                type="button"
                                disabled={endingGame}
                                onClick={handleConfirmEndGame}
                                className="bg-danger hover:bg-danger/90 inline-flex h-10 flex-1 items-center justify-center rounded-xl text-xs font-semibold text-white transition disabled:opacity-60"
                            >
                                {endingGame ? 'Mengakhiri…' : 'Ya, akhiri'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmLeaveModal
                open={exitGuard.open}
                title="Keluar dari permainan?"
                description={
                    <>
                        Pertandingan
                        {room ? ` di ruang ${room.code}` : ''} masih berjalan.
                        Papan, giliran, dan posisi bidak sudah tersimpan di
                        server, jadi kamu bisa melanjutkan lewat tautan ruang
                        ini kapan saja. Yakin ingin keluar sekarang?
                    </>
                }
                cancelLabel="Lanjut main"
                confirmLabel="Ya, keluar"
                onCancel={exitGuard.cancel}
                onConfirm={exitGuard.leave}
            />
        </>
    );
}
