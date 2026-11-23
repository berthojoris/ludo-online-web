import {
    BASE_POSITION,
    boardAbsoluteTrackIndex,
    DEFAULT_CHARACTER_BY_COLOR,
    defaultBoardArms,
    getBoardSpec,
    getCharacterConfig,
    isBoardSafeIndex,
    PLAYER_CONFIG,
} from '@/lib/ludo';
import type {
    Action,
    GameState,
    LegalMove,
    PlayerId,
    SetupCharacters,
    SetupNames,
} from './matchTypes';
import type { PlayerCount } from '@/lib/ludo';

export const PLAYER_IDS: PlayerId[] = ['blue', 'green'];
export const LOCAL_COUNTS: PlayerCount[] = [2, 3, 4, 5, 6, 7];

function createTokenMap(): Record<PlayerId, number[]> {
    return {
        red: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
        yellow: [-1, -1, -1, -1],
        blue: [-1, -1, -1, -1],
        purple: [-1, -1, -1, -1],
        orange: [-1, -1, -1, -1],
        teal: [-1, -1, -1, -1],
        pink: [-1, -1, -1, -1],
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
        pink: 0,
    };
}

export const DEFAULT_NAMES: SetupNames = {
    blue: 'Kamu',
    green: 'Lawan',
    red: 'Merah',
    yellow: 'Kuning',
    purple: 'Ungu',
    orange: 'Oranye',
    teal: 'Toska',
    pink: 'Pink',
};

export const DEFAULT_CHARACTERS: SetupCharacters = {
    ...DEFAULT_CHARACTER_BY_COLOR,
};

export const initialState: GameState = {
    version: 0,
    order: PLAYER_IDS,
    arms: 4,
    tokens: createTokenMap(),
    turn: 'blue',
    human: 'blue',
    names: DEFAULT_NAMES,
    characters: DEFAULT_CHARACTERS,
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
    baseRollMisses: createNumberMap(),
    captures: createNumberMap(),
    totalMoves: 0,
    startedAt: null,
    finishedAt: null,
};

export function otherPlayer(
    player: PlayerId,
    order: PlayerId[] = PLAYER_IDS,
): PlayerId {
    return (
        order.find((item) => item !== player) ??
        (player === 'blue' ? 'green' : 'blue')
    );
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

function allTokensInBase(state: GameState, player: PlayerId): boolean {
    return state.tokens[player].every(
        (position) => position === BASE_POSITION,
    );
}

export function rollDieForTurn(state: GameState): number {
    if (
        allTokensInBase(state, state.turn) &&
        state.baseRollMisses[state.turn] >= 3
    ) {
        return 6;
    }

    return randomDie();
}

export function randomPlayer(order: PlayerId[] = PLAYER_IDS): PlayerId {
    return order[Math.floor(Math.random() * order.length)];
}

export function rememberAction(
    actions: Set<string>,
    actionId?: string,
): void {
    if (!actionId) {
        return;
    }

    actions.add(actionId);

    if (actions.size > 200) {
        const oldestAction = actions.values().next().value;

        if (oldestAction) {
            actions.delete(oldestAction);
        }
    }
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
    rawCharacters?: Partial<SetupCharacters>,
): GameState {
    const names = cleanNames(human, rawNames);
    const characters: SetupCharacters = {
        ...DEFAULT_CHARACTERS,
        ...(rawCharacters ?? {}),
    };
    const turn = startingTurn ?? human;
    const resolvedArms = arms ?? defaultBoardArms(order.length);

    return {
        ...initialState,
        order,
        arms: resolvedArms,
        tokens: createTokenMap(),
        human,
        names,
        characters,
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
        baseRollMisses: createNumberMap(),
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

export function computeLegalMoves(
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

export function chooseAiMove(state: GameState): LegalMove | null {
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
                            boardAbsoluteTrackIndex(
                                spec,
                                opponent,
                                position,
                            ) === absolute,
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

export function reducer(state: GameState, action: Action): GameState {
    if (action.type === 'RESTORE') {
        const order = action.match.colors ?? PLAYER_IDS;
        const arms =
            action.match.arms ??
            (order.length === 3 || order.length >= 5
                ? defaultBoardArms(order.length)
                : state.arms);
        const spec = getBoardSpec(order, arms);
        const turn = order[action.match.turn];
        const tokens = createTokenMap();
        const rolls = createNumberMap();
        const captures = createNumberMap();
        order.forEach((color, index) => {
            tokens[color] = action.match.tokens[index] ?? [-1, -1, -1, -1];
            rolls[color] = action.match.stats?.[index]?.rolls ?? 0;
            captures[color] = action.match.stats?.[index]?.captures ?? 0;
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
        const lastRoll = action.match.last_roll ?? null;
        const roller = lastRoll ? order[lastRoll.player] : undefined;
        const restoredVersion = action.match.state_version ?? state.version;

        // A snapshot whose newest action is a roll this client has not seen yet
        // replays that roll so the dice still tumbles before the result lands.
        if (
            action.animateRoll &&
            !winner &&
            lastRoll &&
            roller &&
            lastRoll.state_version === restoredVersion &&
            restoredVersion > state.version
        ) {
            return {
                ...state,
                version: restoredVersion,
                order,
                arms: spec.arms,
                tokens,
                turn: roller,
                dice: lastRoll.value,
                winner: null,
                winners,
                phase: 'rolling',
                legalMoves: [],
                rolls,
                captures,
                totalMoves: action.match.total_moves ?? state.totalMoves,
                startedAt: Number.isNaN(restoredAt)
                    ? state.startedAt
                    : restoredAt,
                message:
                    roller === state.human
                        ? 'Melempar dadu…'
                        : `${state.names[roller]} sedang melempar…`,
            };
        }

        return {
            ...state,
            version: restoredVersion,
            order,
            arms: spec.arms,
            tokens,
            turn,
            dice: dice ?? lastRoll?.value ?? null,
            winner,
            winners,
            phase: winner ? 'gameover' : dice === null ? 'idle' : 'choosing',
            legalMoves: moves,
            rolls,
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
            action.characters,
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
            state.characters,
        );
    }

    if (action.type === 'ROLL_START') {
        if (state.phase !== 'idle' || state.winner) {
            return state;
        }

        return {
            ...state,
            version: action.version ?? state.version,
            phase: 'rolling',
            dice: action.value,
            legalMoves: [],
            rolls: {
                ...state.rolls,
                [state.turn]: state.rolls[state.turn] + 1,
            },
            baseRollMisses:
                action.version !== undefined
                    ? state.baseRollMisses
                    : {
                          ...state.baseRollMisses,
                          [state.turn]:
                              action.value !== 6 &&
                              allTokensInBase(state, state.turn)
                                  ? state.baseRollMisses[state.turn] + 1
                                  : 0,
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
        const finishedWinners =
            playerFinished && !state.winners.includes(actor)
                ? [...state.winners, actor]
                : state.winners;
        const unfinishedPlayers = state.order.filter(
            (color) => !finishedWinners.includes(color),
        );
        const matchOver =
            state.order.length > 1 && unfinishedPlayers.length <= 1;
        const lastPlace = matchOver ? (unfinishedPlayers[0] ?? null) : null;
        const nextWinners = matchOver
            ? [...finishedWinners, ...unfinishedPlayers]
            : finishedWinners;
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
        const nextVersion = action.version ?? state.version;

        const moveDescription =
            from === BASE_POSITION
                ? 'mengeluarkan bidak dari markas'
                : `menggerakkan bidak ${state.dice} langkah`;
        const extraDescription = reachedHome
            ? ' dan membawanya ke garis akhir'
            : captured
              ? ` dan menangkap bidak lawan dengan ${getCharacterConfig(state.characters[actor], actor).skill}`
              : '';
        const finishRank = playerFinished
            ? finishedWinners.indexOf(actor) + 1
            : null;
        const logText =
            finishRank !== null
                ? `${actorName} menyelesaikan semua bidak (Juara ${finishRank})!`
                : `${actorName} ${moveDescription}${extraDescription}.`;
        const logged = appendLog(state, logText, actor);

        if (matchOver) {
            const firstWinner = nextWinners[0];
            const firstWinnerName = state.names[firstWinner];
            const lastPlaceName = lastPlace ? state.names[lastPlace] : null;
            const finalLog = lastPlaceName
                ? appendLog(
                      { ...state, ...logged },
                      `Tersisa satu pemain. ${lastPlaceName} juara terakhir (Juara ${nextWinners.length}).`,
                      lastPlace ?? undefined,
                  )
                : logged;

            return {
                ...state,
                ...finalLog,
                version: nextVersion,
                tokens: nextTokens,
                legalMoves: [],
                phase: 'gameover',
                winner: firstWinner,
                winners: nextWinners,
                captures: nextCaptures,
                totalMoves: nextTotalMoves,
                finishedAt: action.now,
                message: lastPlaceName
                    ? lastPlace === state.human
                        ? `Pertandingan selesai. Kamu juara terakhir, ${firstWinnerName} juara 1.`
                        : `Pertandingan selesai. ${firstWinnerName} juara 1, ${lastPlaceName} juara terakhir.`
                    : firstWinner === state.human
                      ? `Semua pemain selesai. ${firstWinnerName} juara 1!`
                      : `Semua pemain selesai. ${firstWinnerName} memenangkan pertandingan.`,
            };
        }

        if (playerFinished) {
            return {
                ...state,
                ...logged,
                version: nextVersion,
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
                version: nextVersion,
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
            version: nextVersion,
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
