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
import { CSSProperties } from 'react';
import { StarIcon } from './Icons';
import LudoPin from './LudoPin';

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

type LudoBoardProps = {
    tokens?: BoardToken[];
    playerNames?: Partial<Record<PlayerColor, string>>;
    playerCharacters?: Partial<
        Record<PlayerColor, CharacterId | string | null>
    >;
    activeColor?: PlayerColor;
    activeLabel?: string;
    order?: PlayerColor[];
    arms?: number;
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

export default function LudoBoard({
    tokens = [],
    playerNames = {},
    playerCharacters = {},
    activeColor,
    activeLabel,
    order,
    arms,
    className = '',
}: LudoBoardProps) {
    const inferredOrder =
        order ??
        (Object.keys(playerNames).length > 0
            ? (Object.keys(playerNames) as PlayerColor[])
            : (['red', 'green', 'yellow', 'blue'] as PlayerColor[]));
    const spec = getBoardSpec(inferredOrder, arms);
    const cellBox = spec.cellSizePercent * 0.9;
    const cellRx = cellBox * 0.2;

    const layout = new Map<string, { index: number; count: number }>();

    for (const group of tokenGroups(tokens).values()) {
        group.forEach((token, index) => {
            layout.set(token.id, { index, count: group.length });
        });
    }

    return (
        <div
            className={`relative aspect-square w-full select-none ${className}`}
            role="group"
            aria-label={`Papan Ludo ${spec.arms} pemain`}
            style={{ containerType: 'inline-size' }}
        >
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

                {tokens.map((token) => {
                    const config = PLAYER_CONFIG[token.color];
                    const palette = config.palette;
                    const charConfig = getCharacterConfig(
                        token.character ?? playerCharacters[token.color],
                        token.color,
                    );
                    const { index, count } = layout.get(token.id) ?? {
                        index: 0,
                        count: 1,
                    };
                    const [dx, dy] = groupOffset(index, count);
                    const positionStyle = {
                        left: `${spec.isRadial ? token.point.col : (token.point.col / BOARD_SIZE) * 100}%`,
                        top: `${spec.isRadial ? token.point.row : (token.point.row / BOARD_SIZE) * 100}%`,
                        width: `${spec.tokenSizePercent * 1.12}%`,
                        aspectRatio: '1 / 1',
                        transform: `translate(-50%, -50%) translate(${dx}%, ${dy}%)`,
                    } as CSSProperties;

                    const tokenStyle = {
                        '--token-light': palette.light,
                        '--token-base': palette.base,
                        '--token-dark': palette.dark,
                        '--legal-color': palette.base,
                        '--legal-glow': `${palette.base}59`,
                    } as CSSProperties;

                    const label =
                        token.label ?? `Bidak ${config.label} ${index + 1}`;

                    return (
                        <div
                            key={token.id}
                            className={`absolute transition-[left,top] ${
                                token.returning
                                    ? 'z-30 duration-[50ms] ease-linear'
                                    : 'z-20 duration-[140ms] ease-out'
                            }`}
                            style={positionStyle}
                        >
                            {token.legal && (
                                <span
                                    className="legal-move-beacon"
                                    style={tokenStyle}
                                    aria-hidden="true"
                                />
                            )}
                            {token.onClick ? (
                                <button
                                    type="button"
                                    onClick={token.onClick}
                                    disabled={token.busy || !token.legal}
                                    aria-busy={token.busy || undefined}
                                    aria-label={
                                        token.legal
                                            ? `${label} siap digerakkan`
                                            : label
                                    }
                                    className={`relative block h-full w-full transition-transform duration-150 after:absolute after:-inset-3.5 after:rounded-full after:content-[''] active:scale-95 enabled:hover:scale-110 disabled:cursor-not-allowed disabled:opacity-70 ${
                                        token.legal
                                            ? 'animate-legal-pulse cursor-pointer'
                                            : 'cursor-default'
                                    } ${
                                        token.moving
                                            ? 'animate-token-hop pointer-events-none'
                                            : ''
                                    } ${
                                        token.returning
                                            ? 'animate-token-retreat pointer-events-none'
                                            : ''
                                    }`}
                                    style={tokenStyle}
                                >
                                    {token.busy && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute inset-0 m-auto h-3/4 w-3/4 rounded-full border-2 border-white/80 border-t-transparent motion-safe:animate-spin"
                                        />
                                    )}
                                    <LudoPin
                                        className="h-full w-full drop-shadow-[0_2px_4px_rgba(20,32,52,0.28)]"
                                        characterImage={charConfig.image}
                                    />
                                </button>
                            ) : (
                                <div
                                    className={`h-full w-full ${
                                        token.legal ? 'animate-legal-pulse' : ''
                                    } ${
                                        token.moving ? 'animate-token-hop' : ''
                                    } ${
                                        token.returning
                                            ? 'animate-token-retreat'
                                            : ''
                                    }`}
                                    style={tokenStyle}
                                >
                                    <LudoPin
                                        className="h-full w-full drop-shadow-[0_2px_4px_rgba(20,32,52,0.28)]"
                                        characterImage={charConfig.image}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
