import {
    BoardPlacement,
    FLIGHT_SHADOW_KEYFRAMES,
    HIT_KEYFRAMES,
    HIT_STOP_MS,
    HOP_KEYFRAMES,
    launchDuration,
    launchKeyframes,
    LEAP_KEYFRAMES,
    LEAP_MS,
    placementTransform,
    prefersReducedMotion,
    settled,
    SHADOW_HOP_KEYFRAMES,
    SHAKE_KEYFRAMES,
    SPIN_KEYFRAMES,
    WALK_STEP_MS,
    walkKeyframes,
} from '@/lib/boardMotion';
import {
    ARENA_BACKGROUND_IMAGE,
    Cell,
    CharacterId,
    getBoardSpec,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
    SAFE_TRACK_INDICES,
    START_OWNER,
    TRACK,
} from '@/lib/ludo';
import {
    CSSProperties,
    memo,
    Ref,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import CharacterSkillBurst, { SkillBurst } from './CharacterSkillBurst';
import { StarIcon } from './Icons';
import PionFigure, { PionMotion } from './PionFigure';

export type BoardToken = {
    id: string;
    color: PlayerColor;
    character?: CharacterId | string | null;
    point: Cell;
    legal?: boolean;
    busy?: boolean;
    moving?: boolean;
    returning?: boolean;
    onClick?: () => void;
    label?: string;
};

/**
 * Imperative board animations. They run on the compositor through the Web
 * Animations API, so a whole walk costs one React render instead of one per
 * cell. A token keeps its last frame until the parent clears its `moving` or
 * `returning` flag, then settles into the position React renders.
 */
export type LudoBoardHandle = {
    walkToken: (
        id: string,
        path: Cell[],
        options?: { leap?: boolean; onStep?: (index: number) => void },
    ) => Promise<void>;
    knockTokens: (targets: { id: string; to: Cell }[]) => Promise<void>;
    impact: (point: Cell, color: PlayerColor) => void;
    stopAll: () => void;
};

type BoardEffect = {
    id: number;
    kind: 'impact' | 'dust';
    x: number;
    y: number;
    color: PlayerColor;
};

type TokenMotion = {
    animations: Animation[];
    timers: number[];
    /** Set once a commit has shown the token as moving or returning. */
    confirmed: boolean;
};

type LudoBoardProps = {
    ref?: Ref<LudoBoardHandle>;
    tokens?: BoardToken[];
    chatBubbles?: Partial<Record<PlayerColor, { id: number; message: string }>>;
    playerNames?: Partial<Record<PlayerColor, string>>;
    playerCharacters?: Partial<
        Record<PlayerColor, CharacterId | string | null>
    >;
    activeColor?: PlayerColor;
    activeLabel?: string;
    order?: PlayerColor[];
    arms?: number;
    skillBursts?: SkillBurst[];
    onSkillBurstEnd?: (id: string) => void;
    className?: string;
};

const BOARD_SIZE = 15;
const CELL_SIZE = 100 / BOARD_SIZE;

const QUADRANTS: { color: PlayerColor; row: number; col: number }[] = [
    { color: 'red', row: 0, col: 0 },
    { color: 'green', row: 0, col: 9 },
    { color: 'yellow', row: 9, col: 9 },
    { color: 'blue', row: 9, col: 0 },
];

const LANE_CELLS: { color: PlayerColor; cell: Cell }[] = QUADRANTS.flatMap(
    ({ color }) => PLAYER_CONFIG[color].lane.map((cell) => ({ color, cell })),
);

function cellStyle(cell: Cell): CSSProperties {
    return {
        left: `${cell.col * CELL_SIZE}%`,
        top: `${cell.row * CELL_SIZE}%`,
        width: `${CELL_SIZE}%`,
        height: `${CELL_SIZE}%`,
    };
}

function groupOffset(index: number, count: number): number[] {
    if (count <= 1) {
        return [0, 0];
    }

    if (count === 2) {
        return index === 0 ? [-26, 0] : [26, 0];
    }

    if (count === 3) {
        return (
            [
                [-26, -16],
                [26, -16],
                [0, 22],
            ][index] ?? [0, 0]
        );
    }

    return (
        [
            [-24, -24],
            [24, -24],
            [-24, 24],
            [24, 24],
        ][index % 4] ?? [0, 0]
    );
}

/**
 * Fan slots ordered from the front-most (largest downward offset, drawn last)
 * to the back-most, matching the offsets returned by groupOffset().
 */
function frontToBackSlots(count: number): number[] {
    if (count <= 1) {
        return [0];
    }

    if (count === 2) {
        return [1, 0];
    }

    if (count === 3) {
        return [2, 0, 1];
    }

    return [2, 3, 0, 1];
}

function stackPriority(token: BoardToken, activeColor?: PlayerColor): number {
    if (token.legal) {
        return 2;
    }

    return token.color === activeColor ? 1 : 0;
}

function tokenGroups(tokens: BoardToken[]) {
    const groups = new Map<string, BoardToken[]>();

    for (const token of tokens) {
        const key = `${token.point.row.toFixed(3)}:${token.point.col.toFixed(3)}`;
        const group = groups.get(key) ?? [];
        group.push(token);
        groups.set(key, group);
    }

    return groups;
}

type BoardSpec = ReturnType<typeof getBoardSpec>;

/** One rendered token: where it sits and how it looks after stacking rules. */
type TokenPlacement = {
    token: BoardToken;
    placement: BoardPlacement;
    zIndex: number;
    /** Same-color pions sharing a cell draw once; the others stay mounted but hidden. */
    hidden: boolean;
    stackCount: number;
    fanned: boolean;
    legal: boolean;
    busy: boolean;
    onClick?: () => void;
    ordinal: number;
};

function toBoardPercent(spec: BoardSpec, point: Cell) {
    return spec.isRadial
        ? { x: point.col, y: point.row }
        : {
              x: (point.col / BOARD_SIZE) * 100,
              y: (point.row / BOARD_SIZE) * 100,
          };
}

/**
 * Stable per-token placements. Moving and returning tokens are left out of
 * stacking and fanning, so passing over another pion never hides or jostles it.
 */
function placeTokens(
    tokens: BoardToken[],
    spec: BoardSpec,
    activeColor?: PlayerColor,
): TokenPlacement[] {
    const placed: TokenPlacement[] = [];
    const ordinalById = new Map<string, number>();
    const counters = new Map<PlayerColor, number>();
    const depthOf = (y: number, dy: number) =>
        Math.round(y * 4) + (dy > 0 ? 2 : dy < 0 ? 0 : 1);

    for (const token of tokens) {
        const next = counters.get(token.color) ?? 0;
        counters.set(token.color, next + 1);
        ordinalById.set(token.id, next);
    }

    const restingTokens: BoardToken[] = [];

    for (const token of tokens) {
        if (!token.moving && !token.returning) {
            restingTokens.push(token);
            continue;
        }

        const { x, y } = toBoardPercent(spec, token.point);

        placed.push({
            token,
            placement: { x, y, dx: 0, dy: 0 },
            zIndex: (token.returning ? 1500 : 1000) + depthOf(y, 0),
            hidden: false,
            stackCount: 1,
            fanned: false,
            legal: Boolean(token.legal),
            busy: Boolean(token.busy),
            onClick: token.onClick,
            ordinal: ordinalById.get(token.id) ?? 0,
        });
    }

    for (const cellGroup of tokenGroups(restingTokens).values()) {
        const byColor = new Map<PlayerColor, BoardToken[]>();

        for (const token of cellGroup) {
            const list = byColor.get(token.color) ?? [];
            list.push(token);
            byColor.set(token.color, list);
        }

        const primaries: {
            primary: BoardToken;
            members: BoardToken[];
        }[] = [];

        for (const members of byColor.values()) {
            const primary =
                members.find((t) => t.legal) ??
                members.find((t) => t.busy) ??
                members[0];
            primaries.push({ primary, members });
        }

        const count = primaries.length;
        const slots = frontToBackSlots(count);
        // The turn player's pions take the front fan slots so they are not buried under opponents.
        const ranked = primaries
            .map((entry, index) => ({ entry, index }))
            .sort(
                (a, b) =>
                    stackPriority(b.entry.primary, activeColor) -
                        stackPriority(a.entry.primary, activeColor) ||
                    a.index - b.index,
            );

        ranked.forEach(({ entry }, rank) => {
            const { primary, members } = entry;
            const [dx, dy] = groupOffset(slots[rank % slots.length], count);
            const { x, y } = toBoardPercent(spec, primary.point);
            const raised = count > 1 && primary.color === activeColor;
            const depth = depthOf(y, dy);
            const zIndex = primary.legal
                ? 500 + depth
                : raised
                  ? 250 + depth
                  : 10 + depth;
            const legal = members.some((t) => t.legal);
            const busy = members.some((t) => t.busy);
            const onClick =
                members.find((t) => t.legal && t.onClick)?.onClick ??
                members.find((t) => t.onClick)?.onClick;

            for (const member of members) {
                const isPrimary = member === primary;

                placed.push({
                    token: member,
                    placement: { x, y, dx, dy },
                    zIndex,
                    hidden: !isPrimary,
                    stackCount: isPrimary ? members.length : 1,
                    fanned: count > 1,
                    legal: isPrimary && legal,
                    busy: isPrimary && busy,
                    onClick: isPrimary ? onClick : undefined,
                    ordinal: ordinalById.get(member.id) ?? 0,
                });
            }
        });
    }

    // Keep DOM order identical to the input: reordering keyed nodes would
    // detach them and cancel any running animation or transition.
    const inputIndex = new Map(tokens.map((token, index) => [token.id, index]));

    return placed.sort(
        (a, b) =>
            (inputIndex.get(a.token.id) ?? 0) -
            (inputIndex.get(b.token.id) ?? 0),
    );
}

type BoardSurfaceProps = {
    spec: BoardSpec;
    playerNames: Partial<Record<PlayerColor, string>>;
    activeColor?: PlayerColor;
    activeLabel?: string;
};

function samePlayerNames(
    a: Partial<Record<PlayerColor, string>>,
    b: Partial<Record<PlayerColor, string>>,
): boolean {
    const keys = Object.keys(a) as PlayerColor[];

    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) => a[key] === b[key])
    );
}

/** The static board art. It only re-renders when the turn or names change. */
const BoardSurface = memo(
    function BoardSurface({
        spec,
        playerNames,
        activeColor,
        activeLabel,
    }: BoardSurfaceProps) {
        const cellBox = spec.cellSizePercent * 0.9;
        const cellRx = cellBox * 0.2;

        return (
            <div className="absolute inset-0 overflow-hidden rounded-[5.5%] border-[3px] border-white/90 bg-white shadow-[0_22px_55px_-20px_rgba(20,32,52,0.55)]">
                {/* Scenic arena background texture beneath the board */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.16]"
                    style={{
                        backgroundImage: `url('${ARENA_BACKGROUND_IMAGE}')`,
                    }}
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-white/84"
                />

                {spec.isRadial ? (
                    <>
                        <svg
                            viewBox="0 0 100 100"
                            className="absolute inset-0 h-full w-full"
                            aria-hidden="true"
                        >
                            <defs>
                                {spec.wedges.map((wedge) => {
                                    const palette =
                                        PLAYER_CONFIG[wedge.color].palette;

                                    return (
                                        <radialGradient
                                            key={`grad-${wedge.color}`}
                                            id={`grad-${wedge.color}`}
                                            cx="30%"
                                            cy="25%"
                                            r="75%"
                                        >
                                            <stop
                                                offset="0%"
                                                stopColor={palette.light}
                                                stopOpacity="0.45"
                                            />
                                            <stop
                                                offset="65%"
                                                stopColor={palette.base}
                                                stopOpacity="1"
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor={palette.base}
                                                stopOpacity="1"
                                            />
                                        </radialGradient>
                                    );
                                })}
                            </defs>

                            {spec.wedges.map((wedge) => {
                                const palette =
                                    PLAYER_CONFIG[wedge.color].palette;
                                const isActive = wedge.color === activeColor;

                                return (
                                    <g key={`wedge-${wedge.color}`}>
                                        <path
                                            d={wedge.outerPath}
                                            fill={palette.base}
                                        />
                                        <path
                                            d={wedge.outerPath}
                                            fill={`url(#grad-${wedge.color})`}
                                            opacity="0.55"
                                        />
                                        <path
                                            d={wedge.innerPath}
                                            fill="rgba(255,255,255,0.95)"
                                            stroke="rgba(255,255,255,0.75)"
                                            strokeWidth="0.22"
                                            strokeLinejoin="round"
                                        />
                                        {wedge.basePads.map((pad, idx) => (
                                            <circle
                                                key={`pad-${wedge.color}-${idx}`}
                                                cx={pad.x}
                                                cy={pad.y}
                                                r={spec.padSizePercent / 2}
                                                fill="rgba(255,255,255,0.65)"
                                                stroke={`${palette.base}75`}
                                                strokeWidth="0.45"
                                            />
                                        ))}
                                        {activeColor && !isActive && (
                                            <path
                                                d={wedge.outerPath}
                                                fill="rgba(255,255,255,0.26)"
                                            />
                                        )}
                                        {isActive && (
                                            <>
                                                <path
                                                    d={wedge.outerPath}
                                                    fill="none"
                                                    stroke={palette.dark}
                                                    strokeWidth="0.7"
                                                    strokeLinejoin="round"
                                                />
                                                <path
                                                    d={wedge.outerPath}
                                                    fill="none"
                                                    stroke="rgba(255,255,255,0.9)"
                                                    strokeWidth="0.28"
                                                    strokeLinejoin="round"
                                                />
                                            </>
                                        )}
                                    </g>
                                );
                            })}

                            {spec.trackCells.map((cell, index) => {
                                const ownerPalette = cell.owner
                                    ? PLAYER_CONFIG[cell.owner].palette
                                    : null;
                                const starSize = cellBox * 0.27;

                                return (
                                    <g
                                        key={`rtrack-${index}`}
                                        transform={`translate(${cell.x}, ${cell.y}) rotate(${cell.angleDeg})`}
                                    >
                                        <rect
                                            x={-cellBox / 2}
                                            y={-cellBox / 2}
                                            width={cellBox}
                                            height={cellBox}
                                            rx={cellRx}
                                            fill={
                                                ownerPalette
                                                    ? ownerPalette.base
                                                    : '#ffffff'
                                            }
                                            stroke={
                                                ownerPalette
                                                    ? ownerPalette.dark
                                                    : '#dfe5ee'
                                            }
                                            strokeWidth="0.24"
                                        />
                                        {cell.safe && (
                                            <path
                                                d={`M 0 ${-starSize} L ${starSize * 0.29} ${-starSize * 0.31} L ${starSize * 0.95} ${-starSize * 0.31} L ${starSize * 0.42} ${starSize * 0.14} L ${starSize * 0.62} ${starSize * 0.81} L 0 ${starSize * 0.4} L ${-starSize * 0.62} ${starSize * 0.81} L ${-starSize * 0.42} ${starSize * 0.14} L ${-starSize * 0.95} ${-starSize * 0.31} L ${-starSize * 0.29} ${-starSize * 0.31} Z`}
                                                fill={
                                                    ownerPalette
                                                        ? 'rgba(255,255,255,0.92)'
                                                        : '#b8c3d2'
                                                }
                                            />
                                        )}
                                    </g>
                                );
                            })}

                            {spec.wedges.map((wedge) => {
                                const palette =
                                    PLAYER_CONFIG[wedge.color].palette;

                                return wedge.laneCells.map((lane, idx) => (
                                    <g
                                        key={`rlane-${wedge.color}-${idx}`}
                                        transform={`translate(${lane.x}, ${lane.y}) rotate(${lane.angleDeg})`}
                                    >
                                        <rect
                                            x={-cellBox / 2}
                                            y={-cellBox / 2}
                                            width={cellBox}
                                            height={cellBox}
                                            rx={cellRx}
                                            fill={palette.base}
                                            stroke={palette.dark}
                                            strokeWidth="0.24"
                                        />
                                        <circle
                                            cx="0"
                                            cy="0"
                                            r={cellBox * 0.12}
                                            fill="rgba(255,255,255,0.75)"
                                        />
                                    </g>
                                ));
                            })}

                            {spec.wedges.map((wedge) => (
                                <polygon
                                    key={`rcenter-${wedge.color}`}
                                    points={wedge.centerTriangle}
                                    fill={
                                        PLAYER_CONFIG[wedge.color].palette.base
                                    }
                                    stroke="rgba(255,255,255,0.75)"
                                    strokeWidth="0.24"
                                    strokeLinejoin="round"
                                />
                            ))}

                            <circle
                                cx="50"
                                cy="50"
                                r={spec.centerRadius}
                                fill="rgba(255,255,255,0.95)"
                                stroke="#e4e8ee"
                                strokeWidth="0.25"
                            />
                        </svg>

                        {spec.wedges.map((wedge) => {
                            const palette = PLAYER_CONFIG[wedge.color].palette;
                            const isActive = wedge.color === activeColor;
                            const name = playerNames[wedge.color];

                            if (!name && !(isActive && activeLabel)) {
                                return null;
                            }

                            return (
                                <div
                                    key={`rbadge-${wedge.color}`}
                                    className="pointer-events-none absolute z-[4] flex max-w-[22%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
                                    style={{
                                        left: `${wedge.badgePos.x}%`,
                                        top: `${wedge.badgePos.y}%`,
                                    }}
                                >
                                    {isActive && activeLabel && (
                                        <span
                                            className="max-w-full truncate rounded-full px-1.5 py-px font-extrabold tracking-[0.06em] text-white uppercase"
                                            style={{
                                                background: palette.dark,
                                                fontSize:
                                                    'clamp(6px, 1.65cqw, 10px)',
                                                lineHeight: 1.25,
                                                boxShadow: `0 2px 6px ${palette.dark}59, inset 0 0 0 1px rgba(255,255,255,0.28)`,
                                            }}
                                        >
                                            {activeLabel}
                                        </span>
                                    )}
                                    {name && (
                                        <span
                                            className="max-w-full truncate rounded-full bg-white/95 px-1.5 py-px font-extrabold shadow-[0_1px_4px_rgba(32,43,58,0.18)]"
                                            style={{
                                                color: palette.text,
                                                fontSize:
                                                    'clamp(6px, 1.6cqw, 10px)',
                                                lineHeight: 1.3,
                                            }}
                                        >
                                            {name}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </>
                ) : (
                    <>
                        {QUADRANTS.map(({ color, row, col }) => {
                            const config = PLAYER_CONFIG[color];
                            const palette = config.palette;
                            const isActive = color === activeColor;

                            return (
                                <div
                                    key={color}
                                    className="absolute rounded-[8%]"
                                    style={{
                                        left: `${col * CELL_SIZE}%`,
                                        top: `${row * CELL_SIZE}%`,
                                        width: `${6 * CELL_SIZE}%`,
                                        height: `${6 * CELL_SIZE}%`,
                                        background: `radial-gradient(circle at 28% 22%, ${palette.light}66, transparent 58%), ${palette.base}`,
                                    }}
                                >
                                    <div
                                        className="absolute inset-[11.5%] rounded-[15%] bg-white/92"
                                        style={{
                                            boxShadow:
                                                'inset 0 2px 10px rgba(32,43,58,0.10), 0 1px 0 rgba(255,255,255,0.8)',
                                        }}
                                    />
                                    {activeColor && !isActive && (
                                        <div
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-0 z-[1] rounded-[8%] bg-white/18"
                                        />
                                    )}
                                    {isActive && (
                                        <div
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-0 z-[3]"
                                        >
                                            <div
                                                className="absolute inset-[2.5%] rounded-[9%]"
                                                style={{
                                                    boxShadow: `inset 0 0 0 2.5px rgba(255,255,255,0.95), 0 0 0 3px ${palette.base}, 0 0 18px 2px ${palette.base}66`,
                                                }}
                                            />
                                            <div
                                                className="animate-turn-flash absolute inset-[2.5%] rounded-[9%]"
                                                style={{
                                                    boxShadow: `0 0 0 6px ${palette.base}, 0 0 30px 8px ${palette.base}80`,
                                                }}
                                            />
                                        </div>
                                    )}
                                    {isActive && activeLabel && (
                                        <div
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-x-[8%] top-[5.5%] z-[2] flex justify-center"
                                        >
                                            <span
                                                className="max-w-full truncate rounded-full px-2.5 py-0.5 font-extrabold tracking-[0.06em] text-white uppercase"
                                                style={{
                                                    background: palette.dark,
                                                    fontSize:
                                                        'clamp(7px, 2.05cqw, 12px)',
                                                    lineHeight: 1.3,
                                                    boxShadow: `0 2px 8px ${palette.dark}59, inset 0 0 0 1px rgba(255,255,255,0.32)`,
                                                }}
                                            >
                                                {activeLabel}
                                            </span>
                                        </div>
                                    )}
                                    {playerNames[color] && (
                                        <div className="absolute inset-x-[12%] bottom-[6%] z-[2] flex justify-center">
                                            <span
                                                className="max-w-full truncate rounded-full bg-white/95 px-2.5 py-0.5 font-extrabold shadow-[0_1px_5px_rgba(32,43,58,0.18)]"
                                                style={{
                                                    color: palette.text,
                                                    fontSize:
                                                        'clamp(6.5px, 1.85cqw, 11.5px)',
                                                    lineHeight: 1.3,
                                                }}
                                            >
                                                {playerNames[color]}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {QUADRANTS.map(({ color }) => {
                            const palette = PLAYER_CONFIG[color].palette;

                            return PLAYER_CONFIG[color].base.map(
                                (pad, index) => (
                                    <span
                                        key={`pad-${color}-${index}`}
                                        className="absolute z-[1] rounded-full border-2 bg-white/70"
                                        style={{
                                            left: `${(pad.col / BOARD_SIZE) * 100}%`,
                                            top: `${(pad.row / BOARD_SIZE) * 100}%`,
                                            width: '9.4%',
                                            aspectRatio: '1 / 1',
                                            transform: 'translate(-50%, -50%)',
                                            borderColor: `${palette.base}65`,
                                        }}
                                    />
                                ),
                            );
                        })}

                        {TRACK.map((cell, index) => {
                            const owner = START_OWNER[index];
                            const ownerPalette = owner
                                ? PLAYER_CONFIG[owner].palette
                                : null;
                            const safe = SAFE_TRACK_INDICES.has(index);

                            return (
                                <div
                                    key={`track-${index}`}
                                    className="absolute"
                                    style={cellStyle(cell)}
                                >
                                    <div
                                        className="absolute inset-[5%] flex items-center justify-center rounded-[20%] border"
                                        style={
                                            ownerPalette
                                                ? {
                                                      background:
                                                          ownerPalette.base,
                                                      borderColor:
                                                          ownerPalette.dark,
                                                      boxShadow:
                                                          'inset 0 1px 0 rgba(255,255,255,0.28)',
                                                  }
                                                : {
                                                      background: '#ffffff',
                                                      borderColor: '#dfe5ee',
                                                  }
                                        }
                                    >
                                        {safe && (
                                            <StarIcon
                                                className="h-[46%] w-[46%]"
                                                style={{
                                                    color: ownerPalette
                                                        ? 'rgba(255,255,255,0.94)'
                                                        : '#b8c3d2',
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {LANE_CELLS.map(({ color, cell }, index) => {
                            const palette = PLAYER_CONFIG[color].palette;

                            return (
                                <div
                                    key={`lane-${color}-${index}`}
                                    className="absolute"
                                    style={cellStyle(cell)}
                                >
                                    <div
                                        className="absolute inset-[5%] flex items-center justify-center rounded-[20%] border"
                                        style={{
                                            background: palette.base,
                                            borderColor: palette.dark,
                                            boxShadow:
                                                'inset 0 1px 0 rgba(255,255,255,0.28)',
                                        }}
                                    >
                                        <span className="h-[22%] w-[22%] rounded-full bg-white/80" />
                                    </div>
                                </div>
                            );
                        })}

                        <div
                            className="absolute"
                            style={{
                                left: `${6 * CELL_SIZE}%`,
                                top: `${6 * CELL_SIZE}%`,
                                width: `${3 * CELL_SIZE}%`,
                                height: `${3 * CELL_SIZE}%`,
                            }}
                        >
                            <div className="border-line/70 absolute inset-0 overflow-hidden rounded-[6%] border">
                                <div
                                    className="bg-ludo-red absolute inset-0"
                                    style={{
                                        clipPath:
                                            'polygon(0 0, 50% 50%, 0 100%)',
                                    }}
                                />
                                <div
                                    className="bg-ludo-green absolute inset-0"
                                    style={{
                                        clipPath:
                                            'polygon(0 0, 100% 0, 50% 50%)',
                                    }}
                                />
                                <div
                                    className="bg-ludo-yellow absolute inset-0"
                                    style={{
                                        clipPath:
                                            'polygon(100% 0, 100% 100%, 50% 50%)',
                                    }}
                                />
                                <div
                                    className="bg-ludo-blue absolute inset-0"
                                    style={{
                                        clipPath:
                                            'polygon(0 100%, 100% 100%, 50% 50%)',
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    },
    (previous, next) =>
        previous.spec === next.spec &&
        previous.activeColor === next.activeColor &&
        previous.activeLabel === next.activeLabel &&
        samePlayerNames(previous.playerNames, next.playerNames),
);

type TokenViewProps = {
    id: string;
    color: PlayerColor;
    pionImage: string;
    characterName: string;
    label: string;
    transform: string;
    widthPercent: number;
    zIndex: number;
    hidden: boolean;
    legal: boolean;
    busy: boolean;
    motion: PionMotion;
    fanned: boolean;
    stackCount: number;
    clickable: boolean;
    onActivate: (id: string) => void;
    registerElement: (id: string, element: HTMLDivElement | null) => void;
};

/**
 * One pion. The figure is never remounted when the pion becomes clickable or
 * starts moving, so running animations on it are never cut off.
 */
const TokenView = memo(function TokenView({
    id,
    color,
    pionImage,
    characterName,
    label,
    transform,
    widthPercent,
    zIndex,
    hidden,
    legal,
    busy,
    motion,
    fanned,
    stackCount,
    clickable,
    onActivate,
    registerElement,
}: TokenViewProps) {
    const palette = PLAYER_CONFIG[color].palette;
    const elementRef = useCallback(
        (element: HTMLDivElement | null) => registerElement(id, element),
        [id, registerElement],
    );
    const style = {
        width: `${widthPercent}%`,
        aspectRatio: '1 / 1',
        transform,
        zIndex,
        visibility: hidden ? 'hidden' : undefined,
        '--token-light': palette.light,
        '--token-base': palette.base,
        '--token-dark': palette.dark,
    } as CSSProperties;

    return (
        <div
            ref={elementRef}
            className="absolute top-0 left-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.37,0,0.63,1)]"
            style={style}
            aria-hidden={hidden || undefined}
        >
            {clickable && !hidden && (
                <button
                    type="button"
                    onClick={() => onActivate(id)}
                    disabled={busy || !legal}
                    aria-busy={busy || undefined}
                    aria-label={
                        legal
                            ? `${label} (${characterName}) siap digerakkan`
                            : `${label} (${characterName})`
                    }
                    className={`pion-hit absolute inset-x-0 -top-[58%] bottom-0 z-[1] rounded-[45%] after:absolute after:-inset-2 after:rounded-full after:content-[''] disabled:cursor-not-allowed ${
                        legal ? 'cursor-pointer' : 'cursor-default'
                    } ${motion === 'idle' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                />
            )}
            <PionFigure
                pionImage={pionImage}
                legal={legal}
                busy={busy}
                motion={motion}
                stacked={fanned}
                stackCount={stackCount}
            />
        </div>
    );
});

const SPARKS = Array.from({ length: 10 }, (_, index) => index);
const DUST_PUFFS = Array.from({ length: 6 }, (_, index) => index);
const EFFECT_LIFETIME_MS = { impact: 760, dust: 560 } as const;

function BoardEffectView({
    effect,
    onDone,
}: {
    effect: BoardEffect;
    onDone: (id: number) => void;
}) {
    useEffect(() => {
        const timeout = window.setTimeout(
            () => onDone(effect.id),
            EFFECT_LIFETIME_MS[effect.kind],
        );

        return () => window.clearTimeout(timeout);
    }, [effect.id, effect.kind, onDone]);

    const palette = PLAYER_CONFIG[effect.color].palette;
    const style = {
        left: `${effect.x}%`,
        top: `${effect.y}%`,
        '--fx-base': palette.base,
        '--fx-light': palette.light,
    } as CSSProperties;

    if (effect.kind === 'dust') {
        return (
            <span className="board-dust" style={style}>
                {DUST_PUFFS.map((index) => (
                    <span
                        key={index}
                        className="board-dust-puff"
                        style={
                            {
                                '--puff-x': `${(index - 2.5) * 34}%`,
                                '--puff-delay': `${(index % 3) * 24}ms`,
                            } as CSSProperties
                        }
                    />
                ))}
            </span>
        );
    }

    return (
        <span className="board-impact" style={style}>
            <span className="board-impact-ring" />
            {SPARKS.map((index) => (
                <span
                    key={index}
                    className="board-spark"
                    style={
                        {
                            '--spark-angle': `${index * 36 + (index % 2) * 14}deg`,
                            '--spark-distance': `${index % 2 ? 150 : 210}%`,
                            '--spark-delay': `${(index % 3) * 22}ms`,
                        } as CSSProperties
                    }
                />
            ))}
        </span>
    );
}

const DEFAULT_ORDER: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export default function LudoBoard({
    ref,
    tokens = [],
    chatBubbles = {},
    playerNames = {},
    playerCharacters = {},
    activeColor,
    activeLabel,
    order,
    arms,
    skillBursts = [],
    onSkillBurstEnd,
    className = '',
}: LudoBoardProps) {
    const orderKey = (
        order ??
        (Object.keys(playerNames).length > 0
            ? (Object.keys(playerNames) as PlayerColor[])
            : DEFAULT_ORDER)
    ).join(',');
    const spec = useMemo(
        () => getBoardSpec(orderKey.split(',') as PlayerColor[], arms),
        [orderKey, arms],
    );
    const placements = useMemo(
        () => placeTokens(tokens, spec, activeColor),
        [tokens, spec, activeColor],
    );
    const tokenWidth = spec.tokenSizePercent * 1.12;

    const rootRef = useRef<HTMLDivElement>(null);
    const elementsRef = useRef(new Map<string, HTMLDivElement>());
    const placementsRef = useRef(
        new Map<string, { placement: BoardPlacement; color: PlayerColor }>(),
    );
    const clickHandlersRef = useRef(new Map<string, () => void>());
    const motionsRef = useRef(new Map<string, TokenMotion>());
    const effectIdRef = useRef(0);
    const [effects, setEffects] = useState<BoardEffect[]>([]);

    const registerElement = useCallback(
        (id: string, element: HTMLDivElement | null) => {
            if (element) {
                elementsRef.current.set(id, element);
            } else {
                elementsRef.current.delete(id);
            }
        },
        [],
    );

    const onActivate = useCallback((id: string) => {
        clickHandlersRef.current.get(id)?.();
    }, []);

    const stopMotion = useCallback((id: string) => {
        const motion = motionsRef.current.get(id);

        if (!motion) {
            return;
        }

        motion.timers.forEach((timer) => window.clearTimeout(timer));
        motion.animations.forEach((animation) => animation.cancel());
        motionsRef.current.delete(id);
    }, []);

    const addEffect = useCallback((effect: Omit<BoardEffect, 'id'>) => {
        effectIdRef.current += 1;
        const id = effectIdRef.current;

        setEffects((list) => [...list, { ...effect, id }]);
    }, []);

    const removeEffect = useCallback((id: number) => {
        setEffects((list) => list.filter((effect) => effect.id !== id));
    }, []);

    /**
     * Records where each token was committed, and releases held animations of
     * tokens the parent no longer marks as moving so they settle into place.
     */
    useLayoutEffect(() => {
        placementsRef.current = new Map(
            placements.map((item) => [
                item.token.id,
                { placement: item.placement, color: item.token.color },
            ]),
        );
        clickHandlersRef.current = new Map(
            placements.flatMap((item) =>
                item.onClick ? [[item.token.id, item.onClick] as const] : [],
            ),
        );

        const animated = new Set(
            placements
                .filter((item) => item.token.moving || item.token.returning)
                .map((item) => item.token.id),
        );

        for (const [id, motion] of motionsRef.current) {
            if (animated.has(id)) {
                motion.confirmed = true;
            } else if (motion.confirmed) {
                stopMotion(id);
            }
        }
    }, [placements, stopMotion]);

    useEffect(() => {
        const motions = motionsRef.current;

        return () => {
            for (const motion of motions.values()) {
                motion.timers.forEach((timer) => window.clearTimeout(timer));
            }
        };
    }, []);

    useImperativeHandle(ref, () => {
        const feetOffset = tokenWidth * 0.3;
        const toPlacement = (cell: Cell): BoardPlacement => ({
            ...toBoardPercent(spec, cell),
            dx: 0,
            dy: 0,
        });
        const startMotion = (id: string) => {
            stopMotion(id);
            const motion: TokenMotion = {
                animations: [],
                timers: [],
                confirmed: false,
            };
            motionsRef.current.set(id, motion);

            return motion;
        };
        const isCurrent = (id: string, motion: TokenMotion) =>
            motionsRef.current.get(id) === motion;

        return {
            walkToken(id, path, options = {}) {
                const element = elementsRef.current.get(id);

                if (!element || path.length === 0) {
                    return Promise.resolve();
                }

                const reducedMotion = prefersReducedMotion();
                const leap = Boolean(options.leap);
                const targets = path.map(toPlacement);
                const committed = placementsRef.current.get(id);
                const from = committed?.placement ?? targets[0];
                const stepMs = leap ? LEAP_MS : WALK_STEP_MS;
                const iterations = leap ? 1 : targets.length;
                const motion = startMotion(id);
                const walk = element.animate(
                    walkKeyframes(from, targets, reducedMotion),
                    { duration: stepMs * iterations, fill: 'forwards' },
                );

                motion.animations.push(walk);

                if (!reducedMotion) {
                    const figure =
                        element.querySelector<HTMLElement>('.pion-motion');
                    const shadow =
                        element.querySelector<HTMLElement>('.pion-shadow');
                    const timing = { duration: stepMs, iterations };

                    if (figure) {
                        motion.animations.push(
                            figure.animate(
                                leap ? LEAP_KEYFRAMES : HOP_KEYFRAMES,
                                timing,
                            ),
                        );
                    }

                    if (shadow) {
                        motion.animations.push(
                            shadow.animate(SHADOW_HOP_KEYFRAMES, timing),
                        );
                    }
                }

                targets.forEach((_, index) => {
                    motion.timers.push(
                        window.setTimeout(
                            () => options.onStep?.(index),
                            index * stepMs,
                        ),
                    );
                });

                return settled(walk).then(() => {
                    if (
                        leap &&
                        !reducedMotion &&
                        committed &&
                        isCurrent(id, motion) &&
                        walk.playState === 'finished'
                    ) {
                        const landing = targets[targets.length - 1];

                        addEffect({
                            kind: 'dust',
                            x: landing.x,
                            y: landing.y + feetOffset,
                            color: committed.color,
                        });
                    }
                });
            },

            async knockTokens(targets) {
                if (prefersReducedMotion()) {
                    return;
                }

                await Promise.all(
                    targets.map(({ id, to }) => {
                        const element = elementsRef.current.get(id);
                        const committed = placementsRef.current.get(id);

                        if (!element || !committed) {
                            return Promise.resolve();
                        }

                        const destination = toPlacement(to);
                        const duration = launchDuration(
                            committed.placement,
                            destination,
                        );
                        const motion = startMotion(id);
                        const flight = element.animate(
                            launchKeyframes(committed.placement, destination),
                            {
                                duration,
                                delay: HIT_STOP_MS,
                                fill: 'both',
                            },
                        );
                        const figure =
                            element.querySelector<HTMLElement>('.pion-motion');
                        const shadow =
                            element.querySelector<HTMLElement>('.pion-shadow');

                        motion.animations.push(flight);

                        if (figure) {
                            motion.animations.push(
                                figure.animate(HIT_KEYFRAMES, {
                                    duration: HIT_STOP_MS,
                                }),
                                figure.animate(SPIN_KEYFRAMES, {
                                    duration,
                                    delay: HIT_STOP_MS,
                                    easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)',
                                }),
                            );
                        }

                        if (shadow) {
                            motion.animations.push(
                                shadow.animate(FLIGHT_SHADOW_KEYFRAMES, {
                                    duration,
                                    delay: HIT_STOP_MS,
                                }),
                            );
                        }

                        return settled(flight).then(() => {
                            if (
                                isCurrent(id, motion) &&
                                flight.playState === 'finished'
                            ) {
                                addEffect({
                                    kind: 'dust',
                                    x: destination.x,
                                    y: destination.y + feetOffset,
                                    color: committed.color,
                                });
                            }
                        });
                    }),
                );
            },

            impact(point, color) {
                const { x, y } = toBoardPercent(spec, point);

                addEffect({ kind: 'impact', x, y, color });

                if (!prefersReducedMotion()) {
                    rootRef.current?.animate(SHAKE_KEYFRAMES, {
                        duration: 360,
                        easing: 'ease-out',
                    });
                }
            },

            stopAll() {
                for (const id of [...motionsRef.current.keys()]) {
                    stopMotion(id);
                }
            },
        };
    }, [spec, tokenWidth, stopMotion, addEffect]);

    const dustEffects = effects.filter((effect) => effect.kind === 'dust');
    const impactEffects = effects.filter((effect) => effect.kind === 'impact');

    return (
        <div
            ref={rootRef}
            className={`relative aspect-square w-full select-none ${className}`}
            role="group"
            aria-label={`Papan Ludo ${spec.arms} pemain`}
            style={{ containerType: 'inline-size' }}
        >
            <BoardSurface
                spec={spec}
                playerNames={playerNames}
                activeColor={activeColor}
                activeLabel={activeLabel}
            />

            <div className="pointer-events-none absolute inset-0 z-[20]">
                {(spec.isRadial
                    ? spec.wedges.map((wedge) => ({
                          color: wedge.color,
                          x:
                              wedge.basePads.reduce(
                                  (sum, pad) => sum + pad.x,
                                  0,
                              ) / wedge.basePads.length,
                          y:
                              Math.min(...wedge.basePads.map((pad) => pad.y)) -
                              10,
                      }))
                    : QUADRANTS.map(({ color, row, col }) => ({
                          color,
                          x: (col + 3) * CELL_SIZE,
                          y: row * CELL_SIZE + 2,
                      }))
                ).map(({ color, x, y }) => {
                    const bubble = chatBubbles[color];
                    if (!bubble) return null;

                    return (
                        <div
                            key={`${color}-${bubble.id}`}
                            className="home-chat-bubble"
                            style={{
                                left: `${Math.max(24, Math.min(76, x))}%`,
                                top: `${Math.max(2, Math.min(66, y))}%`,
                            }}
                        >
                            <div
                                className="home-chat-bubble__message"
                                tabIndex={0}
                            >
                                {bubble.message}
                            </div>
                        </div>
                    );
                })}
            </div>

            {dustEffects.length > 0 && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-[5]"
                >
                    {dustEffects.map((effect) => (
                        <BoardEffectView
                            key={effect.id}
                            effect={effect}
                            onDone={removeEffect}
                        />
                    ))}
                </div>
            )}

            {/* Tokens live outside the clipped board so tall pions on the top row keep their crowns. */}
            <div className="pointer-events-none absolute inset-0 z-[5]">
                {placements.map((item) => {
                    const { token } = item;
                    const charConfig = getCharacterConfig(
                        token.character ?? playerCharacters[token.color],
                        token.color,
                    );

                    return (
                        <TokenView
                            key={token.id}
                            id={token.id}
                            color={token.color}
                            pionImage={charConfig.pion}
                            characterName={charConfig.name}
                            label={
                                token.label ??
                                `Bidak ${PLAYER_CONFIG[token.color].label} ${item.ordinal + 1}`
                            }
                            transform={placementTransform(item.placement)}
                            widthPercent={tokenWidth}
                            zIndex={item.zIndex}
                            hidden={item.hidden}
                            legal={item.legal}
                            busy={item.busy}
                            motion={
                                token.returning
                                    ? 'knocked'
                                    : token.moving
                                      ? 'hop'
                                      : 'idle'
                            }
                            fanned={item.fanned}
                            stackCount={item.stackCount}
                            clickable={Boolean(item.onClick)}
                            onActivate={onActivate}
                            registerElement={registerElement}
                        />
                    );
                })}
            </div>

            {(skillBursts.length > 0 || impactEffects.length > 0) && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-[6]"
                >
                    {impactEffects.map((effect) => (
                        <BoardEffectView
                            key={effect.id}
                            effect={effect}
                            onDone={removeEffect}
                        />
                    ))}
                    {skillBursts.map((burst) => {
                        const { x, y } = toBoardPercent(spec, burst.point);

                        return (
                            <CharacterSkillBurst
                                key={burst.id}
                                burst={burst}
                                leftPercent={x}
                                topPercent={y}
                                onEnd={onSkillBurstEnd}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
