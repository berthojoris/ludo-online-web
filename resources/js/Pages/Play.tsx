import CharacterSelectModal from '@/Components/Game/CharacterSelectModal';
import { SkillBurst } from '@/Components/Game/CharacterSkillBurst';
import ConfirmLeaveModal from '@/Components/Game/ConfirmLeaveModal';
import ContinueOnDeviceModal from '@/Components/Game/ContinueOnDeviceModal';
import Dice from '@/Components/Game/Dice';
import FullscreenToggle from '@/Components/Game/FullscreenToggle';
import {
    ChevronLeftIcon,
    CloseIcon,
    DeviceHandoffIcon,
    DiceIcon,
    HashIcon,
    LogoutIcon,
    RefreshIcon,
    SoundOffIcon,
    SoundOnIcon,
    SparklesIcon,
    TrophyIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import LudoBoard, {
    BoardToken,
    LudoBoardHandle,
} from '@/Components/Game/LudoBoard';
import MatchResultModal, {
    MatchStanding,
} from '@/Components/Game/MatchResultModal';
import PlayerCard from '@/Components/Game/PlayerCard';
import RoomChat, { RoomChatPanel } from '@/Components/Game/RoomChat';
import TurnCountdownHud, {
    TURN_TIMEOUT_SECONDS,
    formatTurnTimer,
} from '@/Components/Game/TurnCountdownHud';
import {
    chooseAiMove,
    computeLegalMoves,
    DEFAULT_CHARACTERS,
    DEFAULT_NAMES,
    initialState,
    LOCAL_COUNTS,
    otherPlayer,
    PLAYER_IDS,
    randomPlayer,
    reducer,
    rememberAction,
    rollDieForTurn,
} from '@/features/game/matchEngine';
import type {
    MatchActionData,
    MatchCommandResponse,
    MatchSnapshot,
    PlayerId,
    Screen,
    SetupCharacters,
    SetupNames,
} from '@/features/game/matchTypes';
import { reportClientIssue } from '@/lib/clientIssues';
import {
    ALL_CHARACTER_IDS,
    ARENA_BACKGROUND_IMAGE,
    BASE_POSITION,
    boardAbsoluteTrackIndex,
    boardTokenPoint,
    CHARACTER_LIST,
    CharacterId,
    DEFAULT_CHARACTER_BY_COLOR,
    defaultBoardArms,
    getBoardSpec,
    getCharacterConfig,
    isBoardSafeIndex,
    PLAYER_CONFIG,
    PlayerColor,
    PlayerCount,
    SEATS_BY_COUNT,
} from '@/lib/ludo';
import {
    isSoundEnabled,
    playCharacterSkillSound,
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
    preloadCharacterSounds,
    setSoundEnabled,
    startBackgroundMusic,
    stopBackgroundMusic,
    unlockAudio,
} from '@/lib/sound';
import { preloadImages } from '@/lib/preloadImages';
import { useGameExitGuard } from '@/lib/useGameExitGuard';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { hasCoarsePointer, useModalViewport } from '@/lib/useModalViewport';
import { useRoomHeartbeat } from '@/lib/useRoomHeartbeat';
import { User } from '@/types';
import { HttpResponseError, ReloadOptions } from '@inertiajs/core';
import {
    Head,
    Link,
    router,
    useForm,
    useHttp,
    usePage,
    usePoll,
} from '@inertiajs/react';
import {
    echo,
    echoIsConfigured,
    useConnectionStatus,
} from '@laravel/echo-react';
import {
    CSSProperties,
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';

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
    const [chatBubbles, setChatBubbles] = useState<Partial<Record<PlayerColor, { id: number; message: string }>>>({});
    const showChatBubble = useCallback((item: { id: number; seat_color?: PlayerColor | string | null; message: string }) => {
        if (!item.seat_color || !(item.seat_color in PLAYER_CONFIG)) {
            return;
        }
        const color = item.seat_color as PlayerColor;
        setChatBubbles((current) => ({ ...current, [color]: { id: item.id, message: item.message } }));
        window.setTimeout(() => {
            setChatBubbles((current) => current[color]?.id === item.id
                ? { ...current, [color]: undefined }
                : current);
        }, 7000);
    }, []);
    const { auth, room, me, roomNotice } = usePage().props as unknown as {
        auth?: { user: User | null };
        room?: {
            code: string;
            max_players: number;
            status: string;
            is_quick?: boolean;
            starting_player_id?: number | null;
            started_at?: string | null;
            server_now?: number;
            match_state?: MatchSnapshot | null;
            players: {
                id: number;
                name: string;
                seat_color: PlayerColor | null;
                character?: CharacterId | string | null;
                is_ready: boolean;
                is_host: boolean;
                is_computer?: boolean;
            }[];
        } | null;
        me?: {
            id: number;
            name: string;
            seat_color: PlayerColor | null;
            character?: CharacterId | string | null;
            is_host: boolean;
        } | null;
        roomNotice?: string | null;
    };
    const accountName = me?.name ?? auth?.user?.name?.split(' ')[0] ?? 'Pemain';
    const roomOrder = useMemo<PlayerId[]>(
        () =>
            room?.match_state?.colors ??
            (room ? (['blue', 'green'] as PlayerId[]) : PLAYER_IDS),
        [room],
    );
    const roomArms =
        room?.match_state?.arms ??
        (room ? defaultBoardArms(room.max_players) : 4);
    const canRestartMatch = !room || Boolean(me?.is_host);
    const myRoomIndex =
        room?.players.findIndex((player) => player.id === me?.id) ?? -1;
    const myRoomColor: PlayerId = roomOrder[myRoomIndex] ?? 'blue';
    const roomOtherPlayer = room?.players.find((p) => p.id !== me?.id);

    const [screen, setScreen] = useState<Screen>(room ? 'game' : 'setup');
    const [setupCount, setSetupCount] = useState<PlayerCount>(2);
    const [humanColor, setHumanColor] = useState<PlayerId>('blue');
    const [humanCharacter, setHumanCharacter] =
        useState<CharacterId>('frost_claw');
    const [setupCharModalOpen, setSetupCharModalOpen] = useState(false);
    const [yourName, setYourName] = useState(accountName);
    const [opponentName, setOpponentName] = useState(
        roomOtherPlayer?.name ?? 'Lawan',
    );
    const [state, dispatch] = useReducer(reducer, initialState);
    const [movingToken, setMovingToken] = useState<MovingToken | null>(null);
    const [returningTokens, setReturningTokens] = useState<MovingToken[]>([]);
    const [skillBursts, setSkillBursts] = useState<SkillBurst[]>([]);
    const skillBurstIdRef = useRef(0);
    const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [endGameModalOpen, setEndGameModalOpen] = useState(false);
    const [continueDeviceOpen, setContinueDeviceOpen] = useState(false);
    const endGameOverlayStyle = useModalViewport(endGameModalOpen);
    const [endingGame, setEndingGame] = useState(false);
    const endGamePanelRef = useRef<HTMLDivElement>(null);
    const endGameCancelRef = useRef<HTMLButtonElement>(null);
    const endGameOpenerRef = useRef<HTMLElement | null>(null);
    const endingGameRef = useRef(endingGame);
    endingGameRef.current = endingGame;
    const [boardRef, boardSize] = useBoardSize(screen === 'game');
    const boardHandleRef = useRef<LudoBoardHandle>(null);
    const leaveForm = useForm({});
    const leavePendingRef = useRef(false);
    const rollHttp = useHttp<
        { timeout?: boolean; state_version?: number },
        MatchCommandResponse
    >();
    const moveHttp = useHttp<{ token_index: number }, MatchCommandResponse>({
        token_index: 0,
    });
    const computerHttp = useHttp<{ computer: boolean; state_version: number }, MatchCommandResponse>({ computer: true, state_version: 0 });
    const computerPendingRef = useRef(false);
    const [computerRetry, setComputerRetry] = useState(0);
    const timeoutHttp = useHttp<{ timeout: boolean; state_version: number }, MatchCommandResponse>({
        timeout: true,
        state_version: 0,
    });
    const timeoutPendingRef = useRef(false);
    const autoPlayAfterTimeoutRollRef = useRef(false);
    const serverClockOffsetRef = useRef(0);
    const connectionStatus = useConnectionStatus();
    const movingRef = useRef(false);
    const previousTurnRef = useRef<PlayerId | null>(null);
    const rollPendingRef = useRef(false);
    const movePendingRef = useRef(false);
    const autoMoveAttemptRef = useRef<string | null>(null);
    const seenActionsRef = useRef<Set<string>>(new Set());
    const pendingActionsRef = useRef<MatchActionData[]>([]);
    const pendingSnapshotRef = useRef<MatchSnapshot | null>(null);
    const stateRef = useRef(state);
    const roomRef = useRef(room);
    const roomSyncPendingRef = useRef(false);
    const animationGenerationRef = useRef(0);
    const activeMatchKeyRef = useRef<string | null>(null);
    const connectionStatusRef = useRef(connectionStatus);
    const previousConnectionStatusRef = useRef(connectionStatus);
    stateRef.current = state;
    roomRef.current = room;
    connectionStatusRef.current = connectionStatus;

    const cancelMoveAnimations = useCallback(() => {
        animationGenerationRef.current += 1;
        boardHandleRef.current?.stopAll();
        movingRef.current = false;
        setMovingToken(null);
        setReturningTokens([]);
    }, []);

    const removeSkillBurst = useCallback((id: string) => {
        setSkillBursts((bursts) => bursts.filter((burst) => burst.id !== id));
    }, []);

    const restoreMatch = useCallback(
        (match: MatchSnapshot, { animateRoll = true } = {}) => {
            cancelMoveAnimations();
            dispatch({
                type: 'RESTORE',
                match: {
                    ...match,
                    started_at: roomRef.current?.started_at ?? null,
                },
                animateRoll,
            });
        },
        [cancelMoveAnimations],
    );

    const isMatchAnimating = useCallback(
        () => stateRef.current.phase === 'rolling' || movingRef.current,
        [],
    );

    const roomSyncOptions = useCallback((trigger: string): ReloadOptions => {
        let ownsSync = false;

        return {
            only: ['room'],
            showProgress: false,
            onBefore: () => {
                if (
                    leavePendingRef.current ||
                    roomSyncPendingRef.current ||
                    document.visibilityState === 'hidden' ||
                    !navigator.onLine
                ) {
                    return false;
                }

                ownsSync = true;
                roomSyncPendingRef.current = true;
            },
            onHttpException: (response) => {
                reportClientIssue(
                    'Room synchronization returned an HTTP error',
                    {
                        source: 'game.sync',
                        roomCode: roomRef.current?.code,
                        action: trigger,
                        context: {
                            connection: connectionStatusRef.current,
                            http_status: response.status,
                        },
                    },
                );
            },
            onNetworkError: (error) => {
                if (!navigator.onLine) {
                    return;
                }

                reportClientIssue('Room synchronization failed', {
                    level: 'warning',
                    source: 'game.sync',
                    roomCode: roomRef.current?.code,
                    action: trigger,
                    stack: error.stack,
                    context: {
                        connection: connectionStatusRef.current,
                    },
                });
            },
            onFinish: () => {
                if (ownsSync) {
                    roomSyncPendingRef.current = false;
                }
            },
        };
    }, []);

    const syncRoomState = useCallback(
        (trigger: string) => {
            if (
                !roomRef.current?.code ||
                roomSyncPendingRef.current ||
                document.visibilityState === 'hidden' ||
                !navigator.onLine
            ) {
                return;
            }

            router.reload(roomSyncOptions(trigger));
        },
        [roomSyncOptions],
    );

    const pollIntervalMs = connectionStatus === 'connected' ? 5000 : 2000;

    const { start: startPolling, stop: stopPolling } = usePoll(
        pollIntervalMs,
        () => roomSyncOptions('poll'),
        { autoStart: false, background: 'pause', mode: 'rest' },
    );

    useEffect(() => {
        if (!room || !me) {
            return;
        }

        const matchKey = `${room.code}:${me.id}`;
        const isNewMatch = activeMatchKeyRef.current !== matchKey;
        const snapshot = room.match_state;

        if (isNewMatch) {
            activeMatchKeyRef.current = matchKey;
            seenActionsRef.current.clear();
            pendingActionsRef.current = [];
            pendingSnapshotRef.current = null;
            cancelMoveAnimations();

            const initialTurn: PlayerId =
                roomOrder[
                    room.players.findIndex(
                        (player) => player.id === room.starting_player_id,
                    )
                ] ?? roomOrder[0];
            const names = { ...initialState.names };
            const characters = { ...initialState.characters };
            room.players.forEach((player, index) => {
                const seatColor = roomOrder[index];
                if (seatColor) {
                    names[seatColor] = player.name;
                    characters[seatColor] = getCharacterConfig(
                        player.character,
                        seatColor,
                    ).id;
                }
            });

            previousTurnRef.current = initialTurn;
            dispatch({
                type: 'START',
                human: myRoomColor,
                turn: initialTurn,
                names,
                characters,
                order: roomOrder,
                arms: roomArms,
                now: Date.now(),
            });
        }

        if (
            snapshot &&
            (isNewMatch ||
                (snapshot.state_version ?? 0) > stateRef.current.version)
        ) {
            if (!isNewMatch && isMatchAnimating()) {
                const pending = pendingSnapshotRef.current;

                if (
                    !pending ||
                    (snapshot.state_version ?? 0) > (pending.state_version ?? 0)
                ) {
                    pendingSnapshotRef.current = snapshot;
                }
            } else {
                restoreMatch(snapshot, { animateRoll: !isNewMatch });
            }
        }

        setScreen('game');
    }, [
        room,
        me,
        roomOrder,
        roomArms,
        myRoomColor,
        cancelMoveAnimations,
        restoreMatch,
        isMatchAnimating,
    ]);

    useEffect(() => {
        if (!room?.code || !me?.id) {
            stopPolling();
            return;
        }

        startPolling();
        syncRoomState('mount');

        return () => stopPolling();
    }, [room?.code, me?.id, startPolling, stopPolling, syncRoomState]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                syncRoomState('visibility');
            }
        };
        const handleOnline = () => syncRoomState('online');

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };
    }, [syncRoomState]);

    useEffect(() => {
        const previous = previousConnectionStatusRef.current;

        if (connectionStatus === 'connected' && previous !== 'connected') {
            syncRoomState('reconnect');
        }

        if (connectionStatus === 'failed' && previous !== 'failed') {
            reportClientIssue('Realtime connection failed', {
                level: 'warning',
                source: 'game.realtime',
                roomCode: room?.code,
                action: 'connection',
                context: { connection: connectionStatus },
            });
        }

        previousConnectionStatusRef.current = connectionStatus;
    }, [connectionStatus, room?.code, syncRoomState]);

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
    const inQuickMatch = Boolean(room?.is_quick && me) && screen === 'game';
    const leaveMatch = useCallback((complete: () => void) => {
        const code = room?.code;

        if (!code) {
            complete();
            router.visit(route('home'));

            return;
        }

        if (leavePendingRef.current) {
            return;
        }

        leavePendingRef.current = true;
        leaveForm.post(route('rooms.leave', { code }), {
            replace: true,
            onSuccess: complete,
            onFinish: () => {
                leavePendingRef.current = false;
            },
        });
    }, [room?.code, leaveForm]);
    // The desktop side panel swaps the full player list for a compact
    // current-turn strip plus an always-open chat card; small screens keep
    // the floating chat toggle.
    const isDesktopChat = useMediaQuery('(min-width: 768px)');
    const chatMounted =
        Boolean(room) && Boolean(me) && screen === 'game' && !state.winner;
    const compactPlayers = chatMounted && isDesktopChat;
    const exitGuard = useGameExitGuard(
        matchRunning || inQuickMatch,
        route('home'),
        `play:${room?.code ?? 'solo'}`,
        leaveMatch,
    );
    useRoomHeartbeat(room?.code ?? null, matchRunning && !leaveForm.processing);
    const canRoll =
        (!room || myRoomIndex >= 0) &&
        !rollHttp.processing &&
        !moveHttp.processing &&
        state.turn === state.human &&
        state.phase === 'idle' &&
        !state.winner &&
        !state.winners.includes(state.human);
    const displayDice = state.dice ?? 6;

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

    // Battle music loops for the whole match and stops once it is decided,
    // when the host ends the room, or when the player leaves the game screen.
    const backgroundMusicActive =
        screen === 'game' &&
        !state.winner &&
        (room
            ? Boolean(me) && room.status === 'started' && serverWinner === null
            : true);

    useEffect(() => {
        if (!backgroundMusicActive) {
            stopBackgroundMusic();

            return;
        }

        startBackgroundMusic();

        return () => stopBackgroundMusic();
    }, [backgroundMusicActive]);

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
        async (
            tokenIndex: number,
            fromRemote = false,
            serverAction?: MatchActionData,
        ) => {
            if (movingRef.current || state.phase !== 'choosing') {
                return;
            }

            if (room && !fromRemote && state.turn !== state.human) {
                return;
            }

            if (room && !fromRemote && movePendingRef.current) {
                return;
            }

            const move = state.legalMoves.find(
                (candidate) => candidate.tokenIndex === tokenIndex,
            );

            if (!move) {
                return;
            }

            /**
             * Checks a server-accepted move against local state. Returns false
             * when the move must not be animated (it was restored or ignored).
             */
            const acceptAction = (action?: MatchActionData): boolean => {
                if (!room) {
                    return true;
                }

                const version = action?.state_version;
                const snapshot = action?.match_state;

                if (!version || !snapshot) {
                    reportClientIssue(
                        'Move response is missing its recovery snapshot',
                        {
                            source: 'game.move',
                            roomCode: room.code,
                            action: 'snapshot-missing',
                        },
                    );
                    syncRoomState('move-snapshot-missing');

                    return false;
                }

                if (
                    (action?.action_id &&
                        seenActionsRef.current.has(action.action_id)) ||
                    version <= stateRef.current.version
                ) {
                    return false;
                }

                rememberAction(seenActionsRef.current, action?.action_id);

                if (
                    version !== stateRef.current.version + 1 ||
                    stateRef.current.phase !== 'choosing' ||
                    !stateRef.current.legalMoves.some(
                        (candidate) => candidate.tokenIndex === tokenIndex,
                    )
                ) {
                    restoreMatch(snapshot);

                    return false;
                }

                return true;
            };

            if (fromRemote && !acceptAction(serverAction)) {
                return;
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

            const animationGeneration = animationGenerationRef.current;
            const animationWasCancelled = () =>
                animationGeneration !== animationGenerationRef.current;
            const abortMove = () => {
                if (!animationWasCancelled()) {
                    cancelMoveAnimations();
                }
            };

            // The walk starts before the server answers so a tap feels instant;
            // a rejected move cancels it and the authoritative state is restored.
            movingRef.current = true;
            void unlockAudio();
            setMovingToken({ color, tokenIndex, position: from });

            const walk =
                boardHandleRef.current?.walkToken(
                    `${color}-${tokenIndex}`,
                    steps.map((position) =>
                        boardTokenPoint(
                            activeSpec,
                            color,
                            position,
                            tokenIndex,
                        ),
                    ),
                    {
                        leap: from === BASE_POSITION,
                        onStep: (index) => playHopSound(index),
                    },
                ) ?? Promise.resolve();

            let committedAction = serverAction;

            if (room && !fromRemote) {
                movePendingRef.current = true;
                let acceptedAction: MatchActionData | undefined;

                try {
                    const csrf =
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') ?? '';
                    moveHttp.transform(() => ({ token_index: tokenIndex }));
                    const data = await moveHttp.post(
                        route('rooms.match.move', { code: room.code }),
                        { headers: { 'X-CSRF-TOKEN': csrf } },
                    );

                    if (!data?.action) {
                        abortMove();
                        reportClientIssue(
                            'Move was not accepted; requesting the authoritative state',
                            {
                                level: 'warning',
                                source: 'game.move',
                                roomCode: room.code,
                                action: 'rejected',
                                context: {
                                    connection: connectionStatusRef.current,
                                    http_status: 422,
                                    current_version: stateRef.current.version,
                                },
                            },
                        );
                        syncRoomState('move-rejected');

                        return;
                    }

                    acceptedAction = data.action;
                } catch (error) {
                    abortMove();

                    const status =
                        error instanceof HttpResponseError
                            ? error.response.status
                            : undefined;

                    if (status === 401 || status === 419) {
                        window.location.reload();

                        return;
                    }

                    reportClientIssue('Move request failed', {
                        source: 'game.move',
                        roomCode: room.code,
                        action: 'request',
                        stack: error instanceof Error ? error.stack : undefined,
                        context: {
                            connection: connectionStatusRef.current,
                            http_status: status,
                            current_version: stateRef.current.version,
                        },
                    });
                    syncRoomState('move-failed');

                    return;
                } finally {
                    movePendingRef.current = false;
                }

                if (animationWasCancelled()) {
                    return;
                }

                if (!acceptAction(acceptedAction)) {
                    abortMove();

                    return;
                }

                committedAction = acceptedAction;
            }

            await walk;

            if (animationWasCancelled()) {
                return;
            }

            if (capturedTargets.length > 0) {
                playCharacterSkillSound(state.characters[color], color);
                boardHandleRef.current?.impact(
                    boardTokenPoint(activeSpec, color, move.target, tokenIndex),
                    color,
                );
                skillBurstIdRef.current += 1;
                setSkillBursts((bursts) => [
                    ...bursts,
                    {
                        id: `skill-${skillBurstIdRef.current}`,
                        color,
                        character: state.characters[color],
                        point: boardTokenPoint(
                            activeSpec,
                            color,
                            move.target,
                            tokenIndex,
                        ),
                    },
                ]);
                setReturningTokens(
                    capturedTargets.map((item) => ({
                        color: item.color,
                        tokenIndex: item.tokenIndex,
                        position: item.fromPosition,
                    })),
                );

                // Hit-stop, then each captured pion is thrown back to its base.
                await (boardHandleRef.current?.knockTokens(
                    capturedTargets.map((item) => ({
                        id: `${item.color}-${item.tokenIndex}`,
                        to: boardTokenPoint(
                            activeSpec,
                            item.color,
                            BASE_POSITION,
                            item.tokenIndex,
                        ),
                    })),
                ) ?? Promise.resolve());
            } else if (move.target === activeSpec.finishPosition) {
                playFinishSound();
            }

            if (animationWasCancelled()) {
                return;
            }

            dispatch({
                type: 'MOVE',
                tokenIndex,
                now: Date.now(),
                version: committedAction?.state_version,
            });
            setMovingToken(null);
            setReturningTokens([]);
            movingRef.current = false;
        },
        [
            room,
            moveHttp,
            activeSpec,
            state.phase,
            state.legalMoves,
            state.tokens,
            state.order,
            state.turn,
            state.human,
            state.characters,
            restoreMatch,
            syncRoomState,
            cancelMoveAnimations,
        ],
    );

    const animateMoveRef = useRef(animateMove);
    animateMoveRef.current = animateMove;
    const processMatchActionRef = useRef<(action: MatchActionData) => boolean>(
        () => false,
    );

    /**
     * Applies one server action. Returns true when it changed (or will change)
     * local state, so callers draining a queue wait for the next render.
     */
    processMatchActionRef.current = (action) => {
        if (action.type === 'end') {
            rememberAction(seenActionsRef.current, action.action_id);
            stopBackgroundMusic();
            if (!leavePendingRef.current) {
                router.visit(route('home'), { replace: true });
            }

            return true;
        }

        if (action.action_id && seenActionsRef.current.has(action.action_id)) {
            return false;
        }

        if (isMatchAnimating()) {
            pendingActionsRef.current.push(action);

            return true;
        }

        const currentState = stateRef.current;
        const currentRoom = roomRef.current;
        const version = action.state_version;
        const snapshot = action.match_state;

        if (!action.type || !version || !snapshot || !currentRoom) {
            reportClientIssue(
                'Realtime action is missing its recovery snapshot',
                {
                    source: 'game.realtime',
                    roomCode: currentRoom?.code,
                    action: 'snapshot-missing',
                    context: {
                        connection: connectionStatusRef.current,
                        current_version: currentState.version,
                    },
                },
            );
            syncRoomState('action-snapshot-missing');

            return false;
        }

        if (typeof action.server_now === 'number') {
            serverClockOffsetRef.current = action.server_now - Date.now();
        }

        if (snapshot.afk_auto_move) {
            autoPlayAfterTimeoutRollRef.current = true;
        } else if (action.type === 'move' || snapshot.dice === null) {
            autoPlayAfterTimeoutRollRef.current = false;
        }

        if (version <= currentState.version) {
            rememberAction(seenActionsRef.current, action.action_id);

            return false;
        }

        const restoreAfterRace = (reason: string) => {
            reportClientIssue(
                'Realtime action restored from its authoritative snapshot',
                {
                    level: 'warning',
                    source: 'game.realtime',
                    roomCode: currentRoom.code,
                    action: reason,
                    context: {
                        connection: connectionStatusRef.current,
                        state_version: version,
                        current_version: currentState.version,
                    },
                },
            );
            rememberAction(seenActionsRef.current, action.action_id);
            restoreMatch(snapshot);
        };

        if (version !== currentState.version + 1) {
            restoreAfterRace('version-gap');

            return true;
        }

        const expectedPlayerId =
            currentRoom.players[currentState.order.indexOf(currentState.turn)]
                ?.id;
        const matchesCurrentPlayer =
            expectedPlayerId === undefined ||
            action.player_id === expectedPlayerId;

        if (action.type === 'roll' && typeof action.value === 'number') {
            if (currentState.phase !== 'idle' || !matchesCurrentPlayer) {
                restoreAfterRace('roll-race');

                return true;
            }

            rememberAction(seenActionsRef.current, action.action_id);
            void unlockAudio();
            dispatch({
                type: 'ROLL_START',
                value: action.value,
                version,
            });

            return true;
        }

        if (action.type === 'move' && typeof action.token_index === 'number') {
            const canAnimateMove =
                currentState.phase === 'choosing' &&
                matchesCurrentPlayer &&
                !movingRef.current &&
                currentState.legalMoves.some(
                    (candidate) => candidate.tokenIndex === action.token_index,
                );

            if (!canAnimateMove) {
                restoreAfterRace('move-race');

                return true;
            }

            void animateMoveRef.current(action.token_index, true, action);

            return true;
        }

        restoreAfterRace('invalid-action');

        return true;
    };

    /**
     * Replays actions and snapshots that arrived while the dice or a token was
     * still animating, so they are not applied mid-animation as a jump.
     */
    useEffect(() => {
        const player = room?.players[state.order.indexOf(state.turn)];
        if (!room || !me || !player?.is_computer || state.winner ||
            (state.phase !== 'idle' && state.phase !== 'choosing') || movingToken || returningTokens.length > 0) return;

        let cancelled = false;
        let retryTimer: number | undefined;
        const timer = window.setTimeout(async () => {
            if (computerPendingRef.current) return;
            computerPendingRef.current = true;
            try {
                const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
                computerHttp.transform(() => ({ computer: true, state_version: state.version }));
                const data = await computerHttp.post(route(
                    state.phase === 'idle' ? 'rooms.match.roll' : 'rooms.match.move',
                    { code: room.code },
                ), { headers: { 'X-CSRF-TOKEN': csrf } });
                if (data?.action) processMatchActionRef.current(data.action);
                else throw new Error('Computer action was rejected');
            } catch {
                syncRoomState('computer-action-failed');
                if (!cancelled) retryTimer = window.setTimeout(() => setComputerRetry((n) => n + 1), 3000);
            } finally {
                computerPendingRef.current = false;
            }
        }, state.phase === 'idle' ? 900 : 800);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            if (retryTimer !== undefined) window.clearTimeout(retryTimer);
        };
    }, [room?.code, room?.players, me?.id, state.turn, state.phase, state.version, state.winner, state.order, movingToken, returningTokens, computerRetry]);

    const drainPendingMatchUpdates = useCallback(() => {
        while (pendingActionsRef.current.length > 0) {
            if (isMatchAnimating()) {
                return;
            }

            const next = pendingActionsRef.current.shift();

            if (next && processMatchActionRef.current(next)) {
                return;
            }
        }

        const snapshot = pendingSnapshotRef.current;

        if (!snapshot || isMatchAnimating()) {
            return;
        }

        pendingSnapshotRef.current = null;

        if ((snapshot.state_version ?? 0) > stateRef.current.version) {
            restoreMatch(snapshot);
        }
    }, [isMatchAnimating, restoreMatch]);

    useEffect(() => {
        drainPendingMatchUpdates();
    }, [
        state.phase,
        state.version,
        movingToken,
        returningTokens,
        drainPendingMatchUpdates,
    ]);

    useEffect(() => {
        if (!room?.code || !echoIsConfigured()) {
            return;
        }

        const channelName = `room.${room.code}`;
        const channel = echo().private(channelName);

        if (room.is_quick) {
            channel.listen('.room.updated', () => syncRoomState('room-updated'));
        }

        channel.listen(
            '.match.action',
            (payload: { action?: MatchActionData }) => {
                if (!payload?.action) {
                    reportClientIssue(
                        'Realtime event did not contain an action',
                        {
                            source: 'game.realtime',
                            roomCode: room.code,
                            action: 'invalid-event',
                        },
                    );
                    syncRoomState('invalid-event');

                    return;
                }

                processMatchActionRef.current(payload.action);
            },
        );

        return () => {
            echo().leave(channelName);
        };
    }, [room?.code, room?.is_quick, syncRoomState]);

    useEffect(() => {
        if (!endGameModalOpen) {
            return;
        }

        endGameOpenerRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const focusTimeout = window.setTimeout(() => {
            if (hasCoarsePointer()) {
                endGamePanelRef.current?.focus({ preventScroll: true });
            } else {
                endGameCancelRef.current?.focus();
            }
        }, 40);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !endingGameRef.current) {
                event.preventDefault();
                setEndGameModalOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.clearTimeout(focusTimeout);
            window.removeEventListener('keydown', onKeyDown);

            const opener = endGameOpenerRef.current;
            endGameOpenerRef.current = null;
            if (opener && document.contains(opener)) {
                opener.focus();
            }
        };
    }, [endGameModalOpen]);

    const activeRoomPlayer = room
        ? room.players[state.order.indexOf(state.turn)]
        : undefined;
    const isComputerTurn = room
        ? Boolean(activeRoomPlayer?.is_computer)
        : state.turn !== state.human;

    useEffect(() => {
        if (
            state.phase !== 'choosing' ||
            state.legalMoves.length === 0 ||
            state.winner
        ) {
            if (
                (state.phase === 'idle' &&
                    !rollPendingRef.current &&
                    !timeoutPendingRef.current) ||
                state.winner
            ) {
                autoPlayAfterTimeoutRollRef.current = false;
            }

            return;
        }

        const isAfkAutoMove =
            autoPlayAfterTimeoutRollRef.current ||
            Boolean(
                room?.match_state?.state_version === state.version &&
                    room?.match_state?.afk_auto_move,
            );

        if (room && state.turn !== state.human) {
            if (!isAfkAutoMove || isComputerTurn || timeoutPendingRef.current) {
                return;
            }

            const graceMs =
                1200 + (myRoomIndex >= 0 ? myRoomIndex * 250 : 0);
            const timer = window.setTimeout(async () => {
                const latest = stateRef.current;
                const activeRoom = roomRef.current;
                if (
                    !activeRoom ||
                    latest.winner ||
                    movingRef.current ||
                    latest.phase !== 'choosing' ||
                    latest.version !== state.version ||
                    latest.turn === latest.human ||
                    timeoutPendingRef.current
                ) {
                    return;
                }
                timeoutPendingRef.current = true;
                try {
                    const csrf =
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') ?? '';
                    timeoutHttp.transform(() => ({
                        timeout: true,
                        state_version: latest.version,
                    }));
                    const data = await timeoutHttp.post(
                        route('rooms.match.move', { code: activeRoom.code }),
                        { headers: { 'X-CSRF-TOKEN': csrf } },
                    );
                    if (data?.action) {
                        processMatchActionRef.current(data.action);
                    }
                } catch {
                    syncRoomState('afk-auto-move-race');
                } finally {
                    timeoutPendingRef.current = false;
                    autoPlayAfterTimeoutRollRef.current = false;
                }
            }, graceMs);

            return () => window.clearTimeout(timer);
        }

        if (
            state.turn === state.human &&
            state.legalMoves.length !== 1 &&
            !isAfkAutoMove
        ) {
            return;
        }

        const tokenIndex =
            state.turn === state.human
                ? isAfkAutoMove
                    ? state.legalMoves[
                          Math.floor(Math.random() * state.legalMoves.length)
                      ]?.tokenIndex
                    : state.legalMoves[0].tokenIndex
                : chooseAiMove(state)?.tokenIndex;

        if (tokenIndex === undefined) {
            return;
        }

        // Local practice never bumps `version`, so the roll count is what tells
        // a bonus roll apart from the previous one with the same token.
        const attemptKey = `${state.version}:${state.turn}:${state.rolls[state.turn]}:${tokenIndex}`;

        if (autoMoveAttemptRef.current === attemptKey) {
            return;
        }

        const timeout = window.setTimeout(
            () => {
                autoMoveAttemptRef.current = attemptKey;
                autoPlayAfterTimeoutRollRef.current = false;
                void animateMove(tokenIndex);
            },
            state.turn === state.human ? (isAfkAutoMove ? 450 : 600) : 800,
        );

        return () => window.clearTimeout(timeout);
    }, [room, state, animateMove, isComputerTurn, myRoomIndex, syncRoomState]);

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

                const canInteractWithMove =
                    Boolean(move) &&
                    !movingToken &&
                    returningTokens.length === 0 &&
                    state.turn === state.human;
                const canClickMove =
                    canInteractWithMove && !moveHttp.processing;

                return {
                    id: `${color}-${tokenIndex}`,
                    color,
                    character: state.characters[color],
                    point: boardTokenPoint(
                        activeSpec,
                        color,
                        displayPosition,
                        tokenIndex,
                    ),
                    legal: canClickMove,
                    busy: canInteractWithMove && moveHttp.processing,
                    moving: isMoving,
                    returning: isReturning,
                    onClick: canInteractWithMove
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
        state.characters,
        state.human,
        movingToken,
        returningTokens,
        animateMove,
        moveHttp.processing,
    ]);

    const boardPlayerNames = useMemo(
        () =>
            Object.fromEntries(
                state.order.map((color) => [color, state.names[color]]),
            ),
        [state.order, state.names],
    );

    useEffect(() => {
        const activeCharacters = state.order.map((color) =>
            getCharacterConfig(state.characters[color], color),
        );

        preloadImages(
            activeCharacters.flatMap((character) => [
                character.pion,
                character.image,
                character.killAnimation,
            ]),
        );
        preloadCharacterSounds(
            activeCharacters.map((character) => character.id),
        );
    }, [state.order, state.characters]);

    const finished = (color: PlayerId) =>
        state.tokens[color].filter(
            (position) => position === activeSpec.finishPosition,
        ).length;

    const outOfBase = (color: PlayerId) =>
        state.tokens[color].filter((position) => position !== BASE_POSITION)
            .length;

    const boardWinners = useMemo<PlayerId[]>(() => {
        const finishedWinners = state.winners.filter((color) =>
            state.tokens[color].every(
                (position) => position === activeSpec.finishPosition,
            ),
        );

        if (finishedWinners.length > 0) {
            return finishedWinners;
        }

        return state.winner ? [state.winner] : [];
    }, [state.winners, state.winner, state.tokens, activeSpec.finishPosition]);

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
                character: state.characters[color],
                role: room?.players[state.order.indexOf(color)]?.is_computer
                    ? 'Komputer'
                    : color === state.human
                      ? 'Kamu'
                      : 'Lawan',
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
        state.characters,
        state.human,
        state.captures,
        state.rolls,
        room?.players,
    ]);

    const durationSeconds =
        state.startedAt && state.finishedAt
            ? Math.max(
                  1,
                  Math.round((state.finishedAt - state.startedAt) / 1000),
              )
            : 0;

    const activeSubtitle = (color: PlayerId) => {
        const seatIndex = state.order.indexOf(color);
        const seatForfeited =
            Boolean(room?.players[seatIndex]?.is_computer) &&
            Boolean(room?.match_state?.forfeited?.includes(seatIndex));
        const skipCount =
            room?.match_state?.consecutive_timeouts?.[seatIndex] ?? 0;
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

        if (seatForfeited) {
            return color === state.human
                ? 'AFK · ketuk dadu untuk ambil alih'
                : 'AFK · digantikan komputer';
        }

        if (skipCount > 0) {
            return `AFK · ${skipCount}/3 auto-skip`;
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
        rollHttp.processing || state.phase === 'rolling'
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
    const turnCharacter = getCharacterConfig(
        state.characters[state.turn],
        state.turn,
    );
    const rollButtonStyle = {
        background: canRoll ? rollPalette.dark : rollPalette.soft,
        color: canRoll ? '#ffffff' : rollPalette.text,
        boxShadow: canRoll
            ? `0 12px 26px -12px ${rollPalette.dark}D9`
            : `inset 0 0 0 1px ${rollPalette.base}2e`,
    };

    const executeRoll = async (isTimeout = false) => {
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
            rollHttp.transform(() =>
                isTimeout
                    ? {
                          timeout: true,
                          state_version: stateRef.current.version,
                      }
                    : {},
            );
            const data = await rollHttp.post(
                route('rooms.match.roll', { code: room.code }),
                { headers: { 'X-CSRF-TOKEN': csrf } },
            );

            if (!data?.action) {
                reportClientIssue(
                    'Roll was not accepted; requesting the authoritative state',
                    {
                        level: 'warning',
                        source: 'game.roll',
                        roomCode: room.code,
                        action: 'rejected',
                        context: {
                            connection: connectionStatusRef.current,
                            http_status: 422,
                            current_version: stateRef.current.version,
                        },
                    },
                );
                syncRoomState('roll-rejected');

                return;
            }

            processMatchActionRef.current(data.action);
        } catch (error) {
            const status =
                error instanceof HttpResponseError
                    ? error.response.status
                    : undefined;

            if (status === 401 || status === 419) {
                window.location.reload();

                return;
            }

            reportClientIssue('Roll request failed', {
                source: 'game.roll',
                roomCode: room.code,
                action: 'request',
                stack: error instanceof Error ? error.stack : undefined,
                context: {
                    connection: connectionStatusRef.current,
                    http_status: status,
                    current_version: stateRef.current.version,
                },
            });
            syncRoomState('roll-failed');
        } finally {
            rollPendingRef.current = false;
        }
    };

    const handleRoll = () => executeRoll(false);

    const executeRollRef = useRef(executeRoll);
    executeRollRef.current = executeRoll;

    /**
     * Sends one afk auto-move for the current turn as a timeout command, so
     * the server keeps the turn marked as auto-played for the forfeit
     * counter instead of counting it as the player acting themselves.
     */
    const postTimeoutMove = useCallback(async () => {
        const activeRoom = roomRef.current;

        if (!activeRoom) {
            return;
        }

        timeoutPendingRef.current = true;
        try {
            const csrf =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            timeoutHttp.transform(() => ({
                timeout: true,
                state_version: stateRef.current.version,
            }));
            const data = await timeoutHttp.post(
                route('rooms.match.move', { code: activeRoom.code }),
                { headers: { 'X-CSRF-TOKEN': csrf } },
            );
            if (data?.action) {
                processMatchActionRef.current(data.action);
            }
        } catch {
            syncRoomState('afk-auto-move-race');
        } finally {
            timeoutPendingRef.current = false;
        }
    }, [syncRoomState]);

    const postTimeoutMoveRef = useRef(postTimeoutMove);
    postTimeoutMoveRef.current = postTimeoutMove;

    const isAfkAutoMove =
        autoPlayAfterTimeoutRollRef.current ||
        Boolean(
            room?.match_state?.state_version === state.version &&
                room?.match_state?.afk_auto_move,
        );

    const turnTimerActive =
        screen === 'game' &&
        !blockedByRoom &&
        !state.winner &&
        (state.phase === 'idle' ||
            (state.phase === 'choosing' &&
                state.legalMoves.length > 0 &&
                !isAfkAutoMove)) &&
        !movingToken &&
        returningTokens.length === 0;

    const turnTimerKey = turnTimerActive
        ? `${state.version}:${state.turn}:${state.phase}:${state.rolls[state.turn]}:${state.totalMoves}`
        : null;

    const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);

    useEffect(() => {
        if (room?.server_now) {
            serverClockOffsetRef.current = room.server_now - Date.now();
        }
    }, [room?.server_now]);

    useEffect(() => {
        if (!turnTimerKey) {
            setTurnSecondsLeft(null);
            timeoutPendingRef.current = false;

            return;
        }

        const snapshot = roomRef.current?.match_state;
        const serverTurnStartedAt =
            snapshot &&
            snapshot.state_version === stateRef.current.version &&
            typeof snapshot.turn_started_at === 'number' &&
            snapshot.turn_started_at > 0 &&
            stateRef.current.phase === 'idle'
                ? snapshot.turn_started_at
                : null;

        const estimatedServerNow = Date.now() + serverClockOffsetRef.current;
        const elapsedMs =
            serverTurnStartedAt !== null
                ? Math.max(0, estimatedServerNow - serverTurnStartedAt)
                : 0;
        const initialRemainingMs = Math.max(
            0,
            TURN_TIMEOUT_SECONDS * 1000 - elapsedMs,
        );
        const deadline = Date.now() + initialRemainingMs;

        let triggered = false;
        let graceTimer: number | undefined;
        setTurnSecondsLeft(
            Math.min(
                TURN_TIMEOUT_SECONDS,
                Math.max(0, Math.ceil(initialRemainingMs / 1000)),
            ),
        );

        const executeTimeout = () => {
            const current = stateRef.current;
            const activeRoom = roomRef.current;
            const activePlayer = activeRoom
                ? activeRoom.players[current.order.indexOf(current.turn)]
                : undefined;
            const computerTurn = activeRoom
                ? Boolean(activePlayer?.is_computer)
                : current.turn !== current.human;
            if (current.winner || movingRef.current || computerTurn) {
                return;
            }

            if (!activeRoom || current.turn === current.human) {
                if (current.phase === 'idle') {
                    autoPlayAfterTimeoutRollRef.current = true;
                    void executeRollRef.current(true);
                } else if (
                    current.phase === 'choosing' &&
                    current.legalMoves.length > 0
                ) {
                    if (!activeRoom) {
                        const randomMove =
                            current.legalMoves[
                                Math.floor(
                                    Math.random() *
                                        current.legalMoves.length,
                                )
                            ];
                        if (randomMove) {
                            void animateMoveRef.current(
                                randomMove.tokenIndex,
                            );
                        }
                    } else if (!timeoutPendingRef.current) {
                        // Go through the timeout command path: a manual move
                        // here would tell the server the player acted
                        // themselves and the forfeit counter would never
                        // grow for a stalled seat.
                        void postTimeoutMoveRef.current();
                    }
                }
                return;
            }

            const turnPlayer =
                activeRoom.players[current.order.indexOf(current.turn)];
            if (turnPlayer?.is_computer || timeoutPendingRef.current) {
                return;
            }

            if (current.phase === 'idle') {
                autoPlayAfterTimeoutRollRef.current = true;
            }

            const graceMs =
                1500 + (myRoomIndex >= 0 ? myRoomIndex * 250 : 0);
            graceTimer = window.setTimeout(async () => {
                const latest = stateRef.current;
                if (
                    latest.winner ||
                    movingRef.current ||
                    latest.version !== current.version ||
                    latest.turn === latest.human ||
                    timeoutPendingRef.current
                ) {
                    return;
                }
                timeoutPendingRef.current = true;
                try {
                    const csrf =
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') ?? '';
                    timeoutHttp.transform(() => ({
                        timeout: true,
                        state_version: latest.version,
                    }));
                    const data = await timeoutHttp.post(
                        route(
                            latest.phase === 'idle'
                                ? 'rooms.match.roll'
                                : 'rooms.match.move',
                            { code: activeRoom.code },
                        ),
                        { headers: { 'X-CSRF-TOKEN': csrf } },
                    );
                    if (data?.action) {
                        processMatchActionRef.current(data.action);
                    }
                } catch {
                    syncRoomState('timeout-race');
                } finally {
                    timeoutPendingRef.current = false;
                }
            }, graceMs);
        };

        if (initialRemainingMs <= 0) {
            triggered = true;
            executeTimeout();

            return () => {
                if (graceTimer !== undefined) {
                    window.clearTimeout(graceTimer);
                }
            };
        }

        const interval = window.setInterval(() => {
            const remaining = Math.max(
                0,
                Math.ceil((deadline - Date.now()) / 1000),
            );
            setTurnSecondsLeft(remaining);

            if (remaining <= 0 && !triggered) {
                triggered = true;
                window.clearInterval(interval);
                executeTimeout();
            }
        }, 250);

        return () => {
            window.clearInterval(interval);
            if (graceTimer !== undefined) {
                window.clearTimeout(graceTimer);
            }
        };
    }, [turnTimerKey]);

    const handleConfirmEndGame = () => {
        if (!room || !me?.is_host || endingGame) {
            return;
        }
        cue(playUiSound);
        setEndingGame(true);
        stopBackgroundMusic();
        router.post(
            route('rooms.end', { code: room.code }),
            {},
            {
                onError: () => {
                    // The match is still running if the end request failed.
                    startBackgroundMusic();
                },
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
        setHumanCharacter(DEFAULT_CHARACTER_BY_COLOR[color]);
        cue(playUiSound);
    };

    const startGame = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const order = setupColors;
        const arms = defaultBoardArms(setupCount);
        const names = { ...DEFAULT_NAMES } as SetupNames;
        const characters = { ...DEFAULT_CHARACTERS } as SetupCharacters;
        const usedChars = new Set<CharacterId>([humanCharacter]);

        order.forEach((color) => {
            if (color === humanColor) {
                names[color] = yourName;
                characters[color] = humanCharacter;
            } else {
                const defaultChar = DEFAULT_CHARACTER_BY_COLOR[color];
                const botChar = !usedChars.has(defaultChar)
                    ? defaultChar
                    : (ALL_CHARACTER_IDS.find((id) => !usedChars.has(id)) ??
                      defaultChar);
                usedChars.add(botChar);
                characters[color] = botChar;

                if (setupCount === 2) {
                    names[color] = opponentName;
                } else {
                    names[color] = getCharacterConfig(botChar, color).name;
                }
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
            characters,
            order,
            arms,
            now: Date.now(),
        });
        setMovingToken(null);
        setReturningTokens([]);
        setSkillBursts([]);
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
        setHumanCharacter(
            state.characters[state.human] ??
                DEFAULT_CHARACTER_BY_COLOR[state.human],
        );
        setYourName(state.names[state.human]);
        setOpponentName(state.names[opponentColor]);
        setSkillBursts([]);
        setScreen('setup');
    };

    const playAgain = () => {
        const starter = randomPlayer(state.order);

        cue(playStartSound);
        previousTurnRef.current = starter;
        setMovingToken(null);
        setReturningTokens([]);
        setSkillBursts([]);
        movingRef.current = false;
        dispatch({ type: 'RESET', turn: starter, now: Date.now() });
    };

    return (
        <>
            <Head
                title={screen === 'setup' ? 'Siapkan pemain' : 'Papan latihan'}
            />

            <div className="bg-canvas relative flex h-screen min-h-0 w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]">
                {/* Full-bleed Arena Background Image */}
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

                <header className="relative z-20 shrink-0 border-b border-white/60 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                    <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-2 px-3 sm:h-14 sm:px-6">
                        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
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
                                className="shrink-0 rounded-lg"
                            >
                                <span className="inline-flex min-[430px]:hidden">
                                    <Logo className="h-7 w-7" />
                                </span>
                                <span className="hidden min-[430px]:inline-flex">
                                    <Logo
                                        className="h-7 w-7"
                                        withWordmark
                                        compact
                                    />
                                </span>
                            </Link>
                            <span className="border-line text-ink-muted hidden rounded-full border bg-white px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] uppercase md:inline-flex">
                                {room ? `RUANG #${room.code}` : 'LATIHAN'}
                            </span>
                        </div>

                        {turnSecondsLeft !== null && (
                            <div className="flex min-w-0 items-center justify-center px-1">
                                <TurnCountdownHud
                                    secondsLeft={turnSecondsLeft}
                                    totalSeconds={TURN_TIMEOUT_SECONDS}
                                    phase={state.phase}
                                    playerName={state.names[state.turn]}
                                    isMyTurn={state.turn === state.human}
                                    accentColor={
                                        PLAYER_CONFIG[state.turn].palette.base
                                    }
                                />
                            </div>
                        )}

                        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                            {screen === 'game' && !blockedByRoom && (
                                <span
                                    className="border-line hidden items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[11px] font-bold sm:inline-flex"
                                    style={{
                                        color: PLAYER_CONFIG[state.human]
                                            .palette.text,
                                    }}
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{
                                            background:
                                                PLAYER_CONFIG[state.human]
                                                    .palette.base,
                                        }}
                                    />
                                    <img
                                        src={
                                            getCharacterConfig(
                                                state.characters[state.human],
                                                state.human,
                                            ).image
                                        }
                                        alt=""
                                        width={18}
                                        height={18}
                                        className="h-4.5 w-4.5 rounded-full object-cover"
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
                                    className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-bold tracking-wide uppercase transition"
                                >
                                    End Game
                                </button>
                            )}
                            {room && me && screen === 'game' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        cue(playUiSound);
                                        setContinueDeviceOpen(true);
                                    }}
                                    aria-label="Lanjutkan di perangkat lain"
                                    title="Lanjutkan di perangkat lain"
                                    className="border-line text-ink-muted hover:text-ink inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border bg-white px-2 text-[11px] font-bold transition lg:px-3"
                                >
                                    <DeviceHandoffIcon className="h-4 w-4" />
                                    <span className="hidden lg:inline">
                                        Lanjut di HP
                                    </span>
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
                            {!room && screen === 'game' && (
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
                    {turnSecondsLeft !== null && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] overflow-hidden bg-slate-900/5"
                        >
                            <div
                                className="h-full transition-[width,background-color] duration-300 ease-linear"
                                style={{
                                    width: `${Math.max(0, Math.min(100, (turnSecondsLeft / TURN_TIMEOUT_SECONDS) * 100))}%`,
                                    backgroundColor:
                                        turnSecondsLeft <= 2
                                            ? '#dc2626'
                                            : turnSecondsLeft <= 5
                                              ? '#d97706'
                                              : PLAYER_CONFIG[state.turn]
                                                    .palette.base,
                                }}
                            />
                        </div>
                    )}
                </header>

                {blockedByRoom || (roomNotice && !room) ? (
                    <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
                        <div className="animate-modal-enter shadow-card w-full max-w-md rounded-[24px] border border-white/85 bg-white/95 p-5 backdrop-blur-md sm:p-7">
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
                                        href={route('room', {
                                            code: room.code,
                                        })}
                                        className="bg-brand hover:bg-brand-dark inline-flex h-11 flex-1 items-center justify-center rounded-xl text-xs font-semibold text-white transition"
                                    >
                                        Masuk ke ruang
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </main>
                ) : screen === 'setup' ? (
                    <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
                        <form
                            onSubmit={startGame}
                            className="shadow-card animate-fade-up max-h-[calc(100dvh-72px)] w-full max-w-lg overflow-y-auto rounded-[26px] border border-white/85 bg-white/95 p-4 backdrop-blur-md sm:p-6 [@media(max-height:620px)]:p-3"
                        >
                            <p className="text-brand-ink text-[10px] font-semibold tracking-[0.16em]">
                                SEBELUM BERMAIN
                            </p>
                            <h1 className="text-ink mt-1 text-xl font-semibold tracking-tight sm:text-2xl [@media(max-height:620px)]:text-lg">
                                Siapkan nama, warna & karakter
                            </h1>
                            <p className="text-ink-muted mt-1 text-[11px] leading-5 sm:text-xs [@media(max-height:620px)]:hidden">
                                Pilih jumlah pemain, warna, dan karakter
                                favoritmu. Papan menyesuaikan otomatis untuk 2–7
                                pemain.
                            </p>

                            <fieldset className="mt-2.5 [@media(max-height:620px)]:mt-2">
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

                            <fieldset className="mt-2.5 [@media(max-height:620px)]:mt-2">
                                <legend className="text-ink text-xs font-semibold">
                                    Pilih warnamu
                                </legend>
                                <div
                                    className={`mt-1.5 grid gap-1.5 sm:gap-2 ${
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
                                                className={`flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 text-left transition ${
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
                                                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
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
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            {/* Character Selector Strip */}
                            <div className="mt-2.5 [@media(max-height:620px)]:mt-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-ink text-xs font-semibold">
                                        Karakter kamu
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            cue(playUiSound);
                                            setSetupCharModalOpen(true);
                                        }}
                                        className="text-brand-ink text-[11px] font-bold hover:underline"
                                    >
                                        Lihat detail 7 karakter →
                                    </button>
                                </div>
                                <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                                    {CHARACTER_LIST.map((char) => {
                                        const isSelected =
                                            humanCharacter === char.id;
                                        const palette =
                                            PLAYER_CONFIG[char.accentColor]
                                                .palette;

                                        return (
                                            <button
                                                key={char.id}
                                                type="button"
                                                onClick={() => {
                                                    cue(playUiSound);
                                                    setHumanCharacter(char.id);
                                                }}
                                                aria-pressed={isSelected}
                                                title={`${char.name} (${char.element})`}
                                                className={`flex flex-col items-center rounded-xl p-1 transition ${
                                                    isSelected
                                                        ? 'scale-[1.03]'
                                                        : 'opacity-75 hover:opacity-100'
                                                }`}
                                                style={{
                                                    background: isSelected
                                                        ? palette.soft
                                                        : '#ffffff',
                                                    boxShadow: isSelected
                                                        ? `0 0 0 2px ${palette.base}`
                                                        : 'inset 0 0 0 1px #e4e8ee',
                                                }}
                                            >
                                                <img
                                                    src={char.image}
                                                    alt={char.name}
                                                    width={44}
                                                    height={44}
                                                    className="aspect-square w-full rounded-lg object-cover"
                                                />
                                                <span className="text-ink mt-0.5 w-full truncate text-center text-[8px] font-bold sm:text-[9px]">
                                                    {char.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div
                                className={`mt-2.5 grid gap-2 ${
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
                                        className="border-line text-ink placeholder:text-ink-muted/60 focus:border-brand mt-1 h-10 w-full rounded-xl border bg-white px-3 text-base transition outline-none"
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
                                            className="border-line text-ink placeholder:text-ink-muted/60 focus:border-brand mt-1 h-10 w-full rounded-xl border bg-white px-3 text-base transition outline-none"
                                        />
                                    </label>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="bg-brand hover:bg-brand-dark mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(47,107,239,0.85)] transition active:scale-[0.99] [@media(max-height:620px)]:mt-2 [@media(max-height:620px)]:h-10"
                            >
                                <DiceIcon className="h-4.5 w-4.5" />
                                Mulai bermain
                            </button>

                            <div className="mt-2.5 flex items-center justify-between gap-2 [@media(max-height:620px)]:mt-2">
                                <Link
                                    href={route('home')}
                                    className="text-ink-muted hover:text-ink text-[11px] font-semibold transition"
                                >
                                    Kembali ke beranda
                                </Link>
                                <span className="text-ink-muted inline-flex items-center gap-1 text-[10px] font-medium">
                                    <SparklesIcon className="h-3 w-3" />
                                    {
                                        getCharacterConfig(humanCharacter).name
                                    } · {PLAYER_CONFIG[humanColor].label}
                                </span>
                            </div>
                        </form>
                    </main>
                ) : (
                    <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl min-w-0 flex-1 flex-col px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] sm:px-4 sm:pt-3">
                        <div className="grid min-h-0 min-w-0 flex-1 gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_288px] md:gap-3 lg:grid-cols-[minmax(0,1fr)_328px] lg:gap-4">
                            <section className="flex min-h-0 min-w-0 flex-col gap-2">
                                {state.order.length >= 5 ? (
                                    <div
                                        className={`shadow-card grid shrink-0 gap-1 overflow-hidden rounded-[16px] border border-white/85 bg-white/94 p-1 backdrop-blur-md md:hidden ${
                                            state.order.length === 7
                                                ? 'grid-cols-4'
                                                : 'grid-cols-3'
                                        }`}
                                    >
                                        {state.order.map((color) => {
                                            const palette =
                                                PLAYER_CONFIG[color].palette;
                                            const charCfg = getCharacterConfig(
                                                state.characters[color],
                                                color,
                                            );
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
                                                    <img
                                                        src={charCfg.image}
                                                        alt={charCfg.name}
                                                        width={20}
                                                        height={20}
                                                        className="h-5 w-5 shrink-0 rounded-full object-cover ring-1"
                                                        style={{
                                                            borderColor:
                                                                palette.base,
                                                        }}
                                                    />
                                                    <span className="text-ink min-w-0 flex-1 truncate text-[10px] font-semibold">
                                                        {state.names[color]}
                                                    </span>
                                                    <span
                                                        className="shrink-0 text-[9px] font-bold tabular-nums"
                                                        style={{
                                                            color: palette.text,
                                                        }}
                                                    >
                                                        {isTurn &&
                                                        turnSecondsLeft !== null
                                                            ? `${String(turnSecondsLeft).padStart(2, '0')}s`
                                                            : winRank !== -1
                                                              ? `#${winRank + 1}`
                                                              : `${finished(color)}/4`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="shadow-card grid shrink-0 grid-cols-2 items-stretch overflow-hidden rounded-[18px] border border-white/85 bg-white/95 backdrop-blur-md md:hidden">
                                        {state.order.map((color) => (
                                            <PlayerCard
                                                key={color}
                                                size="sm"
                                                color={color}
                                                name={state.names[color]}
                                                character={
                                                    state.characters[color]
                                                }
                                                role={
                                                    room?.players[
                                                        state.order.indexOf(
                                                            color,
                                                        )
                                                    ]?.is_computer
                                                        ? 'Komputer'
                                                        : color ===
                                                            state.human
                                                          ? 'Kamu'
                                                          : 'Lawan'
                                                }
                                                subtitle={activeSubtitle(color)}
                                                active={
                                                    state.turn === color &&
                                                    !state.winner
                                                }
                                                finished={finished(color)}
                                                countdownSeconds={
                                                    state.turn === color &&
                                                    !state.winner
                                                        ? turnSecondsLeft
                                                        : null
                                                }
                                                className="min-w-0 flex-1"
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="flex min-h-0 min-w-0 flex-1 pt-2 sm:pt-3 md:pt-[clamp(24px,4.5dvh,40px)]">
                                    <div
                                        ref={boardRef}
                                        className="flex h-full min-h-0 w-full min-w-0 items-center justify-center"
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
                                                    ref={boardHandleRef}
                                                    tokens={boardTokens}
                                                    chatBubbles={chatBubbles}
                                                    order={state.order}
                                                    arms={state.arms}
                                                    playerNames={
                                                        boardPlayerNames
                                                    }
                                                    playerCharacters={
                                                        state.characters
                                                    }
                                                    skillBursts={skillBursts}
                                                    onSkillBurstEnd={
                                                        removeSkillBurst
                                                    }
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
                                                    firstWinner={
                                                        boardWinners[0] ?? null
                                                    }
                                                    winners={boardWinners}
                                                    className="h-full w-full"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <aside className="hidden min-h-0 min-w-0 flex-col gap-3 md:flex">
                                <section className="shadow-card shrink-0 rounded-[22px] border border-white/85 bg-white/95 p-4 backdrop-blur-md">
                                    <div className="flex items-center gap-3.5">
                                        <div
                                            className="dice-stage grid aspect-square w-[clamp(72px,6.5vw,92px)] shrink-0 place-items-center rounded-[20px]"
                                            style={
                                                {
                                                    '--dice-dark':
                                                        PLAYER_CONFIG[
                                                            state.turn
                                                        ].palette.dark,
                                                } as CSSProperties
                                            }
                                        >
                                            <Dice
                                                value={displayDice}
                                                rolling={state.phase === 'rolling'}
                                                variant="sapphire"
                                                color={state.turn}
                                                className="h-[60%] w-[60%]"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p
                                                    className="truncate text-[10px] font-extrabold tracking-[0.14em]"
                                                    style={{
                                                        color: PLAYER_CONFIG[
                                                            state.turn
                                                        ].palette.text,
                                                    }}
                                                >
                                                    {turnLabel}
                                                </p>
                                                {turnSecondsLeft !== null && (
                                                    <span
                                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${
                                                            turnSecondsLeft <= 5
                                                                ? 'bg-danger/12 text-danger animate-pulse'
                                                                : turnSecondsLeft <=
                                                                    10
                                                                  ? 'bg-amber-500/15 text-amber-700'
                                                                  : 'bg-surface-muted text-ink-muted'
                                                        }`}
                                                        aria-label={`Sisa waktu giliran ${turnSecondsLeft} detik`}
                                                    >
                                                        {formatTurnTimer(
                                                            turnSecondsLeft,
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <p
                                                className="text-ink mt-1 text-sm leading-5 font-bold"
                                                aria-live="polite"
                                            >
                                                {instruction}
                                            </p>
                                        </div>
                                    </div>

                                    {state.winner ? (
                                        <div
                                            className={`mt-3 grid gap-2 ${canRestartMatch ? 'grid-cols-2' : 'grid-cols-1'}`}
                                        >
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
                                            {canRestartMatch && (
                                                <button
                                                    type="button"
                                                    onClick={playAgain}
                                                    className="bg-brand hover:bg-brand-dark inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-semibold text-white transition active:scale-[0.99]"
                                                >
                                                    <RefreshIcon className="h-4 w-4" />
                                                    Main lagi
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleRoll}
                                                disabled={!canRoll}
                                                aria-busy={rollHttp.processing}
                                                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition active:scale-[0.99] enabled:hover:brightness-95 disabled:cursor-not-allowed"
                                                style={rollButtonStyle}
                                            >
                                                <DiceIcon
                                                    className={`h-4.5 w-4.5 ${rollHttp.processing ? 'motion-safe:animate-spin' : ''}`}
                                                />
                                                {rollLabel}
                                            </button>

                                            <p className="text-ink-muted mt-2 text-center text-[10px] font-medium">
                                                Lempar dadu untuk melangkah
                                            </p>
                                        </>
                                    )}
                                </section>

                                {compactPlayers && room && me ? (
                                    <>
                                        <section className="shadow-card shrink-0 overflow-hidden rounded-[22px] border border-white/85 bg-white/95 backdrop-blur-md">
                                            <div className="shrink-0 px-4 pt-3.5 pb-2">
                                                <h2 className="text-brand-ink text-[10px] font-extrabold tracking-[0.14em]">
                                                    PEMAIN
                                                </h2>
                                            </div>
                                            <div className="px-2 pb-2">
                                                <div
                                                    className="flex min-w-0 items-center gap-2.5 rounded-2xl px-2 py-1.5 transition-colors"
                                                    style={{
                                                        background:
                                                            rollPalette.soft,
                                                        boxShadow: `inset 0 0 0 1.5px ${rollPalette.base}`,
                                                    }}
                                                >
                                                    <img
                                                        src={turnCharacter.image}
                                                        alt={turnCharacter.name}
                                                        width={32}
                                                        height={32}
                                                        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1"
                                                        style={{
                                                            borderColor:
                                                                rollPalette.base,
                                                        }}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-ink truncate text-sm font-bold">
                                                            {
                                                                state.names[
                                                                    state.turn
                                                                ]
                                                            }
                                                        </p>
                                                        <p className="text-ink-muted truncate text-[10px] font-semibold">
                                                            {activeSubtitle(
                                                                state.turn,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className="shrink-0 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-extrabold tabular-nums"
                                                        style={{
                                                            color: rollPalette.text,
                                                        }}
                                                    >
                                                        {finished(state.turn)}/4
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="border-line/60 flex shrink-0 items-center border-t bg-white/70 px-4 py-2.5 [@media(max-height:640px)]:hidden">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-ink-muted text-[9px] font-bold tracking-[0.12em] uppercase">
                                                        Bidakmu keluar
                                                    </p>
                                                    <p className="text-ink mt-0.5 text-sm font-extrabold tabular-nums">
                                                        {outOfBase(state.human)}/4
                                                    </p>
                                                </div>
                                                <div
                                                    className="bg-line/60 mx-3 h-7 w-px shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-ink-muted text-[9px] font-bold tracking-[0.12em] uppercase">
                                                        Total langkah
                                                    </p>
                                                    <p className="text-ink mt-0.5 text-sm font-extrabold tabular-nums">
                                                        {state.totalMoves}
                                                    </p>
                                                </div>
                                            </div>
                                        </section>
                                        <RoomChatPanel
                                            code={room.code}
                                            playerId={me.id}
                                            onMessage={showChatBubble}
                                        />
                                    </>
                                ) : (
                                    <section className="shadow-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-white/85 bg-white/95 backdrop-blur-md">
                                        <div className="shrink-0 px-4 pt-3.5 pb-2">
                                            <h2 className="text-brand-ink text-[10px] font-extrabold tracking-[0.14em]">
                                                PEMAIN
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
                                                    character={
                                                        state.characters[color]
                                                    }
                                                    role={
                                                        room?.players[
                                                            state.order.indexOf(
                                                                color,
                                                            )
                                                        ]?.is_computer
                                                            ? 'Komputer'
                                                            : color ===
                                                                  state.human
                                                              ? 'Kamu'
                                                              : 'Lawan'
                                                    }
                                                    subtitle={activeSubtitle(color)}
                                                    active={
                                                        state.turn === color &&
                                                        !state.winner
                                                    }
                                                    finished={finished(color)}
                                                    countdownSeconds={
                                                        state.turn === color &&
                                                        !state.winner
                                                            ? turnSecondsLeft
                                                            : null
                                                    }
                                                    className={
                                                        state.order.length >= 5
                                                            ? 'shrink-0'
                                                            : 'min-h-0 flex-1'
                                                    }
                                                />
                                            ))}
                                        </div>
                                        <div className="border-line/60 mt-auto flex shrink-0 items-center border-t bg-white/70 px-4 py-3 [@media(max-height:640px)]:hidden">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-ink-muted text-[9px] font-bold tracking-[0.12em] uppercase">
                                                    Bidakmu keluar
                                                </p>
                                                <p className="text-ink mt-0.5 text-sm font-extrabold tabular-nums">
                                                    {outOfBase(state.human)}/4
                                                </p>
                                            </div>
                                            <div
                                                className="bg-line/60 mx-3 h-7 w-px shrink-0"
                                                aria-hidden="true"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-ink-muted text-[9px] font-bold tracking-[0.12em] uppercase">
                                                    Total langkah
                                                </p>
                                                <p className="text-ink mt-0.5 text-sm font-extrabold tabular-nums">
                                                    {state.totalMoves}
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                )}
                            </aside>
                        </div>

                        <div className="shadow-card mt-2 shrink-0 rounded-[20px] border border-white/85 bg-white/95 p-2 backdrop-blur-md md:hidden">
                            <div className="flex items-center gap-2">
                                <div
                                    className="dice-stage grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
                                    style={
                                        {
                                            '--dice-dark':
                                                PLAYER_CONFIG[state.turn]
                                                    .palette.dark,
                                        } as CSSProperties
                                    }
                                >
                                    <Dice
                                        value={displayDice}
                                        rolling={state.phase === 'rolling'}
                                        variant="sapphire"
                                        color={state.turn}
                                        className="h-[66%] w-[66%]"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1.5">
                                        <p
                                            className="truncate text-[9px] font-bold tracking-[0.12em]"
                                            style={{
                                                color: PLAYER_CONFIG[state.turn]
                                                    .palette.text,
                                            }}
                                        >
                                            {turnLabel}
                                        </p>
                                        {turnSecondsLeft !== null && (
                                            <span
                                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums ${
                                                    turnSecondsLeft <= 5
                                                        ? 'bg-danger/12 text-danger animate-pulse'
                                                        : turnSecondsLeft <= 10
                                                          ? 'bg-amber-500/15 text-amber-700'
                                                          : 'bg-surface-muted text-ink-muted'
                                                }`}
                                                aria-label={`Sisa waktu giliran ${turnSecondsLeft} detik`}
                                            >
                                                {formatTurnTimer(
                                                    turnSecondsLeft,
                                                )}
                                            </span>
                                        )}
                                    </div>
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
                                        aria-busy={rollHttp.processing}
                                        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition active:scale-[0.98] enabled:hover:brightness-90 disabled:cursor-not-allowed"
                                        style={rollButtonStyle}
                                    >
                                        <DiceIcon
                                            className={`h-4 w-4 ${rollHttp.processing ? 'motion-safe:animate-spin' : ''}`}
                                        />
                                        <span>
                                            {rollHttp.processing ||
                                            state.phase === 'rolling'
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

            <CharacterSelectModal
                open={setupCharModalOpen}
                seatColor={humanColor}
                initialCharacter={humanCharacter}
                onClose={() => setSetupCharModalOpen(false)}
                onConfirm={(character) => {
                    cue(playUiSound);
                    setHumanCharacter(character);
                    setSetupCharModalOpen(false);
                }}
            />

            {state.winner && screen === 'game' && (
                <MatchResultModal
                    open={resultModalOpen && !exitGuard.open}
                    winner={state.winner}
                    human={state.human}
                    standings={standings}
                    durationSeconds={durationSeconds}
                    totalMoves={state.totalMoves}
                    canRestart={canRestartMatch}
                    onPlayAgain={playAgain}
                    onOpenSetup={openSetup}
                    onClose={() => setResultModalOpen(false)}
                    onLeaveQuickMatch={inQuickMatch ? exitGuard.leave : undefined}
                    leaving={leaveForm.processing}
                />
            )}

            {endGameModalOpen && room && me?.is_host && (
                <div
                    className="modal-overlay bg-ink/20"
                    style={endGameOverlayStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="end-game-title"
                    aria-describedby="end-game-description"
                    onClick={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !endingGame
                        ) {
                            setEndGameModalOpen(false);
                        }
                    }}
                >
                    <div
                        ref={endGamePanelRef}
                        tabIndex={-1}
                        className="modal-panel modal-bezel animate-modal-enter max-w-[min(100%,25rem)] outline-none"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="modal-bezel-card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="bg-danger/10 text-danger grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                                        <LogoutIcon className="h-5 w-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2
                                            id="end-game-title"
                                            className="text-ink text-base font-semibold"
                                        >
                                            Akhiri permainan?
                                        </h2>
                                        <p
                                            id="end-game-description"
                                            className="text-ink-muted mt-1 text-xs leading-relaxed"
                                        >
                                            Pertandingan di ruang {room.code}{' '}
                                            akan dihentikan untuk semua pemain
                                            dan kamu akan kembali ke beranda.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={endingGame}
                                    onClick={() => setEndGameModalOpen(false)}
                                    aria-label="Tutup konfirmasi"
                                    className="btn btn-quiet btn-sm btn-icon shrink-0"
                                >
                                    <CloseIcon className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center gap-2">
                                <button
                                    ref={endGameCancelRef}
                                    type="button"
                                    disabled={endingGame}
                                    onClick={() => setEndGameModalOpen(false)}
                                    className="btn btn-secondary min-w-[6.5rem] flex-1"
                                >
                                    Lanjut main
                                </button>
                                <button
                                    type="button"
                                    disabled={endingGame}
                                    aria-busy={endingGame}
                                    onClick={handleConfirmEndGame}
                                    className="btn btn-danger min-w-[6.5rem] flex-1"
                                >
                                    {endingGame ? 'Mengakhiri…' : 'Ya, akhiri'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {room &&
                me &&
                screen === 'game' &&
                !state.winner &&
                !isDesktopChat && (
                    <RoomChat
                        code={room.code}
                        playerId={me.id}
                        onMessage={showChatBubble}
                    />
                )}

            {room && me && (
                <ContinueOnDeviceModal
                    open={continueDeviceOpen}
                    roomCode={room.code}
                    onClose={() => setContinueDeviceOpen(false)}
                />
            )}

            <ConfirmLeaveModal
                open={exitGuard.open}
                processing={leaveForm.processing}
                title="Keluar dari permainan?"
                description={
                    inQuickMatch ? (
                        <>
                            {matchRunning &&
                                'Komputer akan mengambil alih kursimu. '}
                            Kamu tidak bisa kembali ke ruang ini. Pilih Main
                            Cepat di beranda untuk mencari pertandingan baru.
                        </>
                    ) : me?.is_host ? (
                        <>
                            Sebagai host, keluar dari ruang {room?.code} akan
                            mengakhiri pertandingan dan mengembalikan semua
                            pemain ke halaman utama. Yakin ingin keluar?
                        </>
                    ) : (
                        <>
                            Pertandingan
                            {room ? ` di ruang ${room.code}` : ''} masih berjalan.
                            Papan, giliran, dan posisi bidak sudah tersimpan di
                            server, jadi kamu bisa melanjutkan lewat tautan ruang
                            ini kapan saja. Yakin ingin keluar sekarang?
                        </>
                    )
                }
                cancelLabel="Lanjut main"
                confirmLabel="Ya, keluar"
                onCancel={exitGuard.cancel}
                onConfirm={exitGuard.leave}
            />
        </>
    );
}
