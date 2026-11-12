export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type Cell = {
    row: number;
    col: number;
};

export type PlayerPalette = {
    base: string;
    dark: string;
    light: string;
    soft: string;
    text: string;
};

export type PlayerConfig = {
    label: string;
    startIndex: number;
    lane: Cell[];
    base: Cell[];
    finish: Cell;
    palette: PlayerPalette;
};

export const TRACK: Cell[] = [
    { row: 6, col: 1 },
    { row: 6, col: 2 },
    { row: 6, col: 3 },
    { row: 6, col: 4 },
    { row: 6, col: 5 },
    { row: 5, col: 6 },
    { row: 4, col: 6 },
    { row: 3, col: 6 },
    { row: 2, col: 6 },
    { row: 1, col: 6 },
    { row: 0, col: 6 },
    { row: 0, col: 7 },
    { row: 0, col: 8 },
    { row: 1, col: 8 },
    { row: 2, col: 8 },
    { row: 3, col: 8 },
    { row: 4, col: 8 },
    { row: 5, col: 8 },
    { row: 6, col: 9 },
    { row: 6, col: 10 },
    { row: 6, col: 11 },
    { row: 6, col: 12 },
    { row: 6, col: 13 },
    { row: 6, col: 14 },
    { row: 7, col: 14 },
    { row: 8, col: 14 },
    { row: 8, col: 13 },
    { row: 8, col: 12 },
    { row: 8, col: 11 },
    { row: 8, col: 10 },
    { row: 8, col: 9 },
    { row: 9, col: 8 },
    { row: 10, col: 8 },
    { row: 11, col: 8 },
    { row: 12, col: 8 },
    { row: 13, col: 8 },
    { row: 14, col: 8 },
    { row: 14, col: 7 },
    { row: 14, col: 6 },
    { row: 13, col: 6 },
    { row: 12, col: 6 },
    { row: 11, col: 6 },
    { row: 10, col: 6 },
    { row: 9, col: 6 },
    { row: 8, col: 5 },
    { row: 8, col: 4 },
    { row: 8, col: 3 },
    { row: 8, col: 2 },
    { row: 8, col: 1 },
    { row: 8, col: 0 },
    { row: 7, col: 0 },
    { row: 6, col: 0 },
];

export const TRACK_LENGTH = TRACK.length;

export const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const START_OWNER: Partial<Record<number, PlayerColor>> = {
    0: 'red',
    13: 'green',
    26: 'yellow',
    39: 'blue',
};

export const PLAYER_CONFIG: Record<PlayerColor, PlayerConfig> = {
    red: {
        label: 'Merah',
        startIndex: 0,
        lane: [
            { row: 7, col: 1 },
            { row: 7, col: 2 },
            { row: 7, col: 3 },
            { row: 7, col: 4 },
            { row: 7, col: 5 },
        ],
        base: [
            { row: 1.75, col: 1.75 },
            { row: 1.75, col: 4.25 },
            { row: 4.25, col: 1.75 },
            { row: 4.25, col: 4.25 },
        ],
        finish: { row: 7.5, col: 6.95 },
        palette: {
            base: '#f04452',
            dark: '#c52d3b',
            light: '#ff98a0',
            soft: '#fde8ea',
            text: '#a81f2b',
        },
    },
    green: {
        label: 'Hijau',
        startIndex: 13,
        lane: [
            { row: 1, col: 7 },
            { row: 2, col: 7 },
            { row: 3, col: 7 },
            { row: 4, col: 7 },
            { row: 5, col: 7 },
        ],
        base: [
            { row: 1.75, col: 10.75 },
            { row: 1.75, col: 13.25 },
            { row: 4.25, col: 10.75 },
            { row: 4.25, col: 13.25 },
        ],
        finish: { row: 6.95, col: 7.5 },
        palette: {
            base: '#20c66b',
            dark: '#0f9a4f',
            light: '#7be5ab',
            soft: '#e4f9ee',
            text: '#0c7a3f',
        },
    },
    yellow: {
        label: 'Kuning',
        startIndex: 26,
        lane: [
            { row: 7, col: 13 },
            { row: 7, col: 12 },
            { row: 7, col: 11 },
            { row: 7, col: 10 },
            { row: 7, col: 9 },
        ],
        base: [
            { row: 10.75, col: 10.75 },
            { row: 10.75, col: 13.25 },
            { row: 13.25, col: 10.75 },
            { row: 13.25, col: 13.25 },
        ],
        finish: { row: 7.5, col: 8.05 },
        palette: {
            base: '#f4b915',
            dark: '#c28e05',
            light: '#ffdf7a',
            soft: '#fef6dc',
            text: '#8a6400',
        },
    },
    blue: {
        label: 'Biru',
        startIndex: 39,
        lane: [
            { row: 13, col: 7 },
            { row: 12, col: 7 },
            { row: 11, col: 7 },
            { row: 10, col: 7 },
            { row: 9, col: 7 },
        ],
        base: [
            { row: 10.75, col: 1.75 },
            { row: 10.75, col: 4.25 },
            { row: 13.25, col: 1.75 },
            { row: 13.25, col: 4.25 },
        ],
        finish: { row: 8.05, col: 7.5 },
        palette: {
            base: '#2f80ed',
            dark: '#1e5fc0',
            light: '#86baff',
            soft: '#e8f1fe',
            text: '#1d56ac',
        },
    },
};

export const BASE_POSITION = -1;
export const FINISH_POSITION = 56;
export const LAST_TRACK_POSITION = 50;
export const FIRST_LANE_POSITION = 51;
export const LAST_LANE_POSITION = 55;

export function tokenCell(color: PlayerColor, position: number): Cell {
    const config = PLAYER_CONFIG[color];

    if (position <= LAST_TRACK_POSITION) {
        const cell = TRACK[(config.startIndex + position) % TRACK_LENGTH];

        return { row: cell.row + 0.5, col: cell.col + 0.5 };
    }

    const cell = config.lane[position - FIRST_LANE_POSITION];

    return { row: cell.row + 0.5, col: cell.col + 0.5 };
}

export function tokenPoint(
    color: PlayerColor,
    position: number,
    tokenIndex: number,
): Cell {
    const config = PLAYER_CONFIG[color];

    if (position === BASE_POSITION) {
        return config.base[tokenIndex] ?? config.base[0];
    }

    if (position >= FINISH_POSITION) {
        return config.finish;
    }

    return tokenCell(color, position);
}

export function absoluteTrackIndex(
    color: PlayerColor,
    position: number,
): number | null {
    if (position < 0 || position > LAST_TRACK_POSITION) {
        return null;
    }

    return (PLAYER_CONFIG[color].startIndex + position) % TRACK_LENGTH;
}

export function isSafeAbsoluteIndex(index: number | null): boolean {
    return index !== null && SAFE_TRACK_INDICES.has(index);
}
