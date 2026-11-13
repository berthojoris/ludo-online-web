import {
    Cell,
    PLAYER_CONFIG,
    PlayerColor,
    SAFE_TRACK_INDICES,
    START_OWNER,
    TRACK,
} from '@/lib/ludo';
import { CSSProperties } from 'react';
import { StarIcon } from './Icons';

export type BoardToken = {
    id: string;
    color: PlayerColor;
    point: Cell;
    legal?: boolean;
    moving?: boolean;
    returning?: boolean;
    onClick?: () => void;
    label?: string;
};

type LudoBoardProps = {
    tokens?: BoardToken[];
    playerNames?: Partial<Record<PlayerColor, string>>;
    activeColor?: PlayerColor;
    activeLabel?: string;
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
    activeColor,
    activeLabel,
    className = '',
}: LudoBoardProps) {
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
            aria-label="Papan Ludo"
            style={{ containerType: 'inline-size' }}
        >
            <div className="border-line/80 absolute inset-0 overflow-hidden rounded-[5.5%] border bg-white shadow-[0_18px_45px_-24px_rgba(32,43,58,0.45)]">
                {QUADRANTS.map(({ color, row, col }) => {
                    const config = PLAYER_CONFIG[color];
                    const palette = config.palette;
                    const isActive = color === activeColor;

                    return (
                        <div
                            key={color}
                            className="absolute"
                            style={{
                                left: `${col * CELL_SIZE}%`,
                                top: `${row * CELL_SIZE}%`,
                                width: `${6 * CELL_SIZE}%`,
                                height: `${6 * CELL_SIZE}%`,
                                background: `radial-gradient(circle at 28% 22%, ${palette.light}66, transparent 56%), ${palette.base}`,
                            }}
                        >
                            <div
                                className="absolute inset-[11%] rounded-[16%] bg-white/95"
                                style={{
                                    boxShadow:
                                        'inset 0 2px 10px rgba(32,43,58,0.13), 0 1px 0 rgba(255,255,255,0.7)',
                                }}
                            />
                            {activeColor && !isActive && (
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 z-[1] bg-white/30"
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
                                            boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.95), 0 0 0 3px ${palette.base}, 0 0 18px 2px ${palette.base}66`,
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
                                    className="pointer-events-none absolute inset-x-[10%] top-[6.5%] z-[2] flex justify-center"
                                >
                                    <span
                                        className="max-w-full truncate rounded-full px-2 py-0.5 font-extrabold tracking-[0.08em] text-white uppercase"
                                        style={{
                                            background: palette.dark,
                                            fontSize:
                                                'clamp(7px, 2.1cqw, 12px)',
                                            lineHeight: 1.3,
                                            boxShadow: `0 2px 8px ${palette.dark}59, inset 0 0 0 1px rgba(255,255,255,0.28)`,
                                        }}
                                    >
                                        {activeLabel}
                                    </span>
                                </div>
                            )}
                            {playerNames[color] && (
                                <div className="absolute inset-x-[13%] bottom-[7%] z-[2] flex justify-center">
                                    <span
                                        className="max-w-full truncate rounded-full bg-white/95 px-1.5 py-px font-extrabold shadow-[0_1px_4px_rgba(32,43,58,0.16)]"
                                        style={{
                                            color: palette.text,
                                            fontSize:
                                                'clamp(6.5px, 1.75cqw, 11px)',
                                            lineHeight: 1.35,
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

                    return PLAYER_CONFIG[color].base.map((pad, index) => (
                        <span
                            key={`pad-${color}-${index}`}
                            className="absolute z-[1] rounded-full border-2 bg-white/55"
                            style={{
                                left: `${(pad.col / BOARD_SIZE) * 100}%`,
                                top: `${(pad.row / BOARD_SIZE) * 100}%`,
                                width: '9.4%',
                                aspectRatio: '1 / 1',
                                transform: 'translate(-50%, -50%)',
                                borderColor: `${palette.base}50`,
                            }}
                        />
                    ));
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
                                              background: ownerPalette.base,
                                              borderColor: ownerPalette.dark,
                                              boxShadow:
                                                  'inset 0 1px 0 rgba(255,255,255,0.25)',
                                          }
                                        : {
                                              background: '#ffffff',
                                              borderColor: '#e4e8ee',
                                          }
                                }
                            >
                                {safe && (
                                    <StarIcon
                                        className="h-[46%] w-[46%]"
                                        style={{
                                            color: ownerPalette
                                                ? 'rgba(255,255,255,0.92)'
                                                : '#c9d1dd',
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
                                        'inset 0 1px 0 rgba(255,255,255,0.25)',
                                }}
                            >
                                <span className="h-[20%] w-[20%] rounded-full bg-white/55" />
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
                    <div className="absolute inset-0 overflow-hidden rounded-[6%]">
                        <div
                            className="bg-ludo-red absolute inset-0"
                            style={{
                                clipPath: 'polygon(0 0, 50% 50%, 0 100%)',
                            }}
                        />
                        <div
                            className="bg-ludo-green absolute inset-0"
                            style={{
                                clipPath: 'polygon(0 0, 100% 0, 50% 50%)',
                            }}
                        />
                        <div
                            className="bg-ludo-yellow absolute inset-0"
                            style={{
                                clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)',
                            }}
                        />
                        <div
                            className="bg-ludo-blue absolute inset-0"
                            style={{
                                clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)',
                            }}
                        />
                    </div>
                    <div className="absolute inset-[37%] rotate-45 rounded-[22%] bg-white/95 shadow-[0_2px_6px_rgba(32,43,58,0.22)]" />
                </div>

                {tokens.map((token) => {
                    const config = PLAYER_CONFIG[token.color];
                    const palette = config.palette;
                    const { index, count } = layout.get(token.id) ?? {
                        index: 0,
                        count: 1,
                    };
                    const [dx, dy] = groupOffset(index, count);
                    const positionStyle = {
                        left: `${(token.point.col / BOARD_SIZE) * 100}%`,
                        top: `${(token.point.row / BOARD_SIZE) * 100}%`,
                        width: '5.9%',
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
                            {token.onClick ? (
                                <button
                                    type="button"
                                    onClick={token.onClick}
                                    aria-label={
                                        token.legal
                                            ? `${label} siap digerakkan`
                                            : label
                                    }
                                    className={`ludo-token relative block h-full w-full rounded-full border-2 border-white transition-transform duration-150 after:absolute after:-inset-3.5 after:rounded-full after:content-[''] hover:scale-110 active:scale-95 ${
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
                                />
                            ) : (
                                <div
                                    className={`ludo-token h-full w-full rounded-full border-2 border-white ${
                                        token.legal ? 'animate-legal-pulse' : ''
                                    } ${
                                        token.moving ? 'animate-token-hop' : ''
                                    } ${
                                        token.returning
                                            ? 'animate-token-retreat'
                                            : ''
                                    }`}
                                    style={tokenStyle}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
