export type PlayerColor =
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'purple'
    | 'orange'
    | 'teal';

export type CharacterId =
    | 'ignivar'
    | 'frost_claw'
    | 'solgarde'
    | 'verdantor'
    | 'umrax'
    | 'aqualon'
    | 'zephyira';

export type CharacterConfig = {
    id: CharacterId;
    name: string;
    element: string;
    image: string;
    killAnimation: string;
    pion: string;
    sfx: string;
    accentColor: PlayerColor;
    description: string;
    traits: [string, string, string];
    skill: string;
};

export const ARENA_BACKGROUND_IMAGE = '/assets/background.webp';

export const ALL_CHARACTER_IDS: CharacterId[] = [
    'ignivar',
    'frost_claw',
    'solgarde',
    'verdantor',
    'umrax',
    'aqualon',
    'zephyira',
];

export const DEFAULT_CHARACTER_BY_COLOR: Record<PlayerColor, CharacterId> = {
    red: 'ignivar',
    green: 'verdantor',
    yellow: 'solgarde',
    blue: 'frost_claw',
    purple: 'umrax',
    orange: 'zephyira',
    teal: 'aqualon',
};

export const CHARACTER_CONFIG: Record<CharacterId, CharacterConfig> = {
    ignivar: {
        id: 'ignivar',
        name: 'Ignivar',
        element: 'Api',
        image: '/assets/char_ignivar.webp',
        killAnimation: '/assets/kill/kill_ignivar.webp',
        pion: '/assets/pion/pion_ignivar.webp',
        sfx: '/assets/sfx/ignivar.mp3',
        accentColor: 'red',
        description:
            'Naga penguasa api dengan kekuatan penuh semangat dan tekad juang tinggi.',
        traits: ['Berani', 'Agresif', 'Tangguh'],
        skill: 'Amukan Naga Api',
    },
    frost_claw: {
        id: 'frost_claw',
        name: 'Frostclaw',
        element: 'Es',
        image: '/assets/char_frost_claw.webp',
        killAnimation: '/assets/kill/kill_frost_claw.webp',
        pion: '/assets/pion/pion_frost_claw.webp',
        sfx: '/assets/sfx/frost_claw.mp3',
        accentColor: 'blue',
        description:
            'Serigala es abadi yang berburu dengan ketenangan dingin dan presisi tajam.',
        traits: ['Fokus', 'Lincah', 'Taktis'],
        skill: 'Cakar Es Abadi',
    },
    solgarde: {
        id: 'solgarde',
        name: 'Solgarde',
        element: 'Cahaya',
        image: '/assets/char_solgarde.webp',
        killAnimation: '/assets/kill/kill_solgarde.webp',
        pion: '/assets/pion/pion_solgarde.webp',
        sfx: '/assets/sfx/solgarde.mp3',
        accentColor: 'yellow',
        description:
            'Singa penjaga surya yang memimpin arena dengan wibawa emas dan keberanian.',
        traits: ['Wibawa', 'Kuat', 'Setia'],
        skill: 'Auman Surya',
    },
    verdantor: {
        id: 'verdantor',
        name: 'Verdantor',
        element: 'Alam',
        image: '/assets/char_verdantor.webp',
        killAnimation: '/assets/kill/kill_verdantor.webp',
        pion: '/assets/pion/pion_verdantor.webp',
        sfx: '/assets/sfx/verdantor.mp3',
        accentColor: 'green',
        description:
            'Penjaga hutan purba yang tangguh, sabar, dan selalu menemukan jalan keluar.',
        traits: ['Tenang', 'Seimbang', 'Kokoh'],
        skill: 'Murka Rimba',
    },
    umrax: {
        id: 'umrax',
        name: 'Umrax',
        element: 'Bayangan',
        image: '/assets/char_umrax.webp',
        killAnimation: '/assets/kill/kill_umrax.webp',
        pion: '/assets/pion/pion_umrax.webp',
        sfx: '/assets/sfx/umrax.mp3',
        accentColor: 'purple',
        description:
            'Penguasa bayangan malam yang bergerak senyap dan mengejutkan lawan di tikungan.',
        traits: ['Cerdik', 'Misterius', 'Cepat'],
        skill: 'Terkaman Bayangan',
    },
    aqualon: {
        id: 'aqualon',
        name: 'Aqualon',
        element: 'Samudra',
        image: '/assets/char_aqualon.webp',
        killAnimation: '/assets/kill/kill_aqualon.webp',
        pion: '/assets/pion/pion_aqualon.webp',
        sfx: '/assets/sfx/aqualon.mp3',
        accentColor: 'teal',
        description:
            'Leviathan arus dalam yang menerjang rintangan bagaikan gelombang pasang.',
        traits: ['Adaptif', 'Deras', 'Gigih'],
        skill: 'Gelombang Pasang',
    },
    zephyira: {
        id: 'zephyira',
        name: 'Zephyira',
        element: 'Angin',
        image: '/assets/char_zephyira.webp',
        killAnimation: '/assets/kill/kill_zephyira.webp',
        pion: '/assets/pion/pion_zephyira.webp',
        sfx: '/assets/sfx/zephyira.mp3',
        accentColor: 'orange',
        description:
            'Griffin langit berkilau yang melesat melintasi papan secepat hembusan badai.',
        traits: ['Cepat', 'Bebas', 'Tajam'],
        skill: 'Badai Langit',
    },
};

export const CHARACTER_LIST: CharacterConfig[] = ALL_CHARACTER_IDS.map(
    (id) => CHARACTER_CONFIG[id],
);

export function getCharacterConfig(
    character?: string | null,
    fallbackColor: PlayerColor = 'red',
): CharacterConfig {
    if (character && character in CHARACTER_CONFIG) {
        return CHARACTER_CONFIG[character as CharacterId];
    }

    return CHARACTER_CONFIG[DEFAULT_CHARACTER_BY_COLOR[fallbackColor]];
}

export type PlayerCount = 2 | 3 | 4 | 5 | 6 | 7;

export const ALL_PLAYER_COLORS: PlayerColor[] = [
    'red',
    'green',
    'yellow',
    'blue',
    'purple',
    'orange',
    'teal',
];

export const SEATS_BY_COUNT: Record<PlayerCount, PlayerColor[]> = {
    2: ['red', 'yellow'],
    3: ['red', 'green', 'yellow'],
    4: ['red', 'green', 'blue', 'yellow'],
    5: ['red', 'green', 'yellow', 'blue', 'purple'],
    6: ['red', 'green', 'yellow', 'blue', 'purple', 'orange'],
    7: ['red', 'green', 'yellow', 'blue', 'purple', 'orange', 'teal'],
};

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
    purple: {
        label: 'Ungu',
        startIndex: 44,
        lane: [
            { row: 7, col: 1 },
            { row: 7, col: 2 },
            { row: 7, col: 3 },
            { row: 7, col: 4 },
        ],
        base: [
            { row: 1.75, col: 1.75 },
            { row: 1.75, col: 4.25 },
            { row: 4.25, col: 1.75 },
            { row: 4.25, col: 4.25 },
        ],
        finish: { row: 7.5, col: 7.5 },
        palette: {
            base: '#8b5cf6',
            dark: '#6d28d9',
            light: '#c4b5fd',
            soft: '#f3efff',
            text: '#5b21b6',
        },
    },
    orange: {
        label: 'Oranye',
        startIndex: 55,
        lane: [
            { row: 7, col: 1 },
            { row: 7, col: 2 },
            { row: 7, col: 3 },
            { row: 7, col: 4 },
        ],
        base: [
            { row: 1.75, col: 1.75 },
            { row: 1.75, col: 4.25 },
            { row: 4.25, col: 1.75 },
            { row: 4.25, col: 4.25 },
        ],
        finish: { row: 7.5, col: 7.5 },
        palette: {
            base: '#f97316',
            dark: '#c2410c',
            light: '#fdba74',
            soft: '#fff2e6',
            text: '#9a3412',
        },
    },
    teal: {
        label: 'Toska',
        startIndex: 66,
        lane: [
            { row: 7, col: 1 },
            { row: 7, col: 2 },
            { row: 7, col: 3 },
            { row: 7, col: 4 },
        ],
        base: [
            { row: 1.75, col: 1.75 },
            { row: 1.75, col: 4.25 },
            { row: 4.25, col: 1.75 },
            { row: 4.25, col: 4.25 },
        ],
        finish: { row: 7.5, col: 7.5 },
        palette: {
            base: '#14b8a6',
            dark: '#0f766e',
            light: '#5eead4',
            soft: '#e6fbf8',
            text: '#115e59',
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

export type RadialPoint = {
    x: number;
    y: number;
};

export type RadialCell = {
    x: number;
    y: number;
    angleDeg: number;
    owner?: PlayerColor;
    safe: boolean;
};

export type RadialWedge = {
    color: PlayerColor;
    outerPath: string;
    innerPath: string;
    basePads: RadialPoint[];
    badgePos: RadialPoint;
    centerTriangle: string;
    finishPoint: RadialPoint;
    laneCells: { x: number; y: number; angleDeg: number }[];
};

export type BoardSpec = {
    arms: number;
    isRadial: boolean;
    sectorLength: number;
    trackLength: number;
    lastTrackPosition: number;
    firstLanePosition: number;
    finishPosition: number;
    safeIndices: Set<number>;
    starts: Partial<Record<PlayerColor, number>>;
    cellSizePercent: number;
    tokenSizePercent: number;
    padSizePercent: number;
    trackCells: RadialCell[];
    wedges: RadialWedge[];
    centerRadius: number;
};

const RADIAL_SPEC_CACHE = new Map<number, BoardSpec>();

export function resolveBoardArms(
    order: PlayerColor[],
    explicitArms?: number | null,
): number {
    if (explicitArms === 5 || explicitArms === 6 || explicitArms === 7) {
        return explicitArms;
    }

    if (explicitArms === 4) {
        return 4;
    }

    let maxIndex = 0;
    for (const color of order) {
        const idx = ALL_PLAYER_COLORS.indexOf(color);
        if (idx > maxIndex) {
            maxIndex = idx;
        }
    }

    const needed = Math.max(order.length, maxIndex + 1);

    return needed >= 5 ? Math.min(7, needed) : 4;
}

function buildRadialSpec(arms: 5 | 6 | 7): BoardSpec {
    const cached = RADIAL_SPEC_CACHE.get(arms);
    if (cached) {
        return cached;
    }

    const stepsPerArm = 5;
    const sectorLength = 11;
    const trackLength = arms * sectorLength;
    const lastTrackPosition = trackLength - 2;
    const firstLanePosition = trackLength - 1;
    const finishPosition = trackLength + 3;

    const ringColors = ALL_PLAYER_COLORS.slice(0, arms);
    const starts: Partial<Record<PlayerColor, number>> = {};
    const safeIndices = new Set<number>();

    for (let k = 0; k < arms; k++) {
        starts[ringColors[k]] = k * sectorLength;
        safeIndices.add(k * sectorLength);
        safeIndices.add(k * sectorLength + 6);
    }

    const tanHalf = Math.tan(Math.PI / arms);
    const sinHalf = Math.sin(Math.PI / arms);
    const rInFactor = 1.5 / tanHalf;
    const rOutFactor = rInFactor + stepsPerArm;
    const rCornerFactor = Math.hypot(rOutFactor, 1.5);
    const rWedgeOuterFactor = rCornerFactor + 0.55;

    const d = 46.8 / rWedgeOuterFactor;
    const rIn = rInFactor * d;
    const rWedgeOuter = rWedgeOuterFactor * d;
    const cx = 50;
    const cy = 50;

    const armGeom = Array.from({ length: arms }, (_, k) => {
        const theta = -Math.PI / 2 + (k * 2 * Math.PI) / arms;
        const ux = Math.cos(theta);
        const uy = Math.sin(theta);
        const vx = -uy;
        const vy = ux;
        const angleDeg = (theta * 180) / Math.PI + 90;

        const pt = (r: number, perp: number): RadialPoint => ({
            x: cx + r * ux + perp * vx,
            y: cy + r * uy + perp * vy,
        });

        return { theta, ux, uy, vx, vy, angleDeg, pt };
    });

    const pOut = (k: number, t: number) =>
        armGeom[k].pt(rIn + (t + 0.5) * d, -d);
    const pIn = (k: number, t: number) =>
        armGeom[k].pt(rIn + (t + 0.5) * d, d);
    const pTip = (k: number) => armGeom[k].pt(rIn + 4.5 * d, 0);

    const trackCells: RadialCell[] = [];
    for (let k = 0; k < arms; k++) {
        const nextK = (k + 1) % arms;

        for (let t = 3; t >= 0; t--) {
            const p = pIn(k, t);
            const idx = trackCells.length;
            trackCells.push({
                x: p.x,
                y: p.y,
                angleDeg: armGeom[k].angleDeg,
                owner: t === 3 ? ringColors[k] : undefined,
                safe: safeIndices.has(idx),
            });
        }

        for (let t = 0; t < stepsPerArm; t++) {
            const p = pOut(nextK, t);
            const idx = trackCells.length;
            trackCells.push({
                x: p.x,
                y: p.y,
                angleDeg: armGeom[nextK].angleDeg,
                safe: safeIndices.has(idx),
            });
        }

        const tip = pTip(nextK);
        trackCells.push({
            x: tip.x,
            y: tip.y,
            angleDeg: armGeom[nextK].angleDeg,
            safe: false,
        });

        const corner = pIn(nextK, 4);
        trackCells.push({
            x: corner.x,
            y: corner.y,
            angleDeg: armGeom[nextK].angleDeg,
            safe: false,
        });
    }

    const wedges: RadialWedge[] = [];
    const margin = 0.42 * d;

    for (let k = 0; k < arms; k++) {
        const curr = armGeom[k];
        const next = armGeom[(k + 1) % arms];
        const color = ringColors[k];

        const rSideOuter = Math.sqrt(
            rWedgeOuter * rWedgeOuter - 1.5 * d * (1.5 * d),
        );
        const vIn = curr.pt(rIn, 1.5 * d);
        const vOutA = curr.pt(rSideOuter, 1.5 * d);
        const vOutB = next.pt(rSideOuter, -1.5 * d);

        const outerPath = `M ${vIn.x.toFixed(3)} ${vIn.y.toFixed(3)} L ${vOutA.x.toFixed(3)} ${vOutA.y.toFixed(3)} A ${rWedgeOuter.toFixed(3)} ${rWedgeOuter.toFixed(3)} 0 0 1 ${vOutB.x.toFixed(3)} ${vOutB.y.toFixed(3)} Z`;

        const phi = curr.theta + Math.PI / arms;
        const bx = Math.cos(phi);
        const by = Math.sin(phi);
        const wx = -by;
        const wy = bx;

        const rApexInner = (1.5 * d + margin) / sinHalf;
        const rInnerArc = rWedgeOuter - margin;
        const rSideInner = Math.sqrt(
            rInnerArc * rInnerArc - (1.5 * d + margin) * (1.5 * d + margin),
        );

        const wIn: RadialPoint = {
            x: cx + rApexInner * bx,
            y: cy + rApexInner * by,
        };
        const wOutA = curr.pt(rSideInner, 1.5 * d + margin);
        const wOutB = next.pt(rSideInner, -(1.5 * d + margin));

        const innerPath = `M ${wIn.x.toFixed(3)} ${wIn.y.toFixed(3)} L ${wOutA.x.toFixed(3)} ${wOutA.y.toFixed(3)} A ${rInnerArc.toFixed(3)} ${rInnerArc.toFixed(3)} 0 0 1 ${wOutB.x.toFixed(3)} ${wOutB.y.toFixed(3)} Z`;

        const rPadInner = rApexInner + (0.48 * d) / tanHalf;
        const rPadOuter = rInnerArc - 0.56 * d;
        const rPadMid = (rPadInner + rPadOuter) / 2;
        const spread =
            arms === 5 ? 0.8 * d : arms === 6 ? 0.66 * d : 0.54 * d;

        const basePads: RadialPoint[] = [
            { x: cx + rPadInner * bx, y: cy + rPadInner * by },
            {
                x: cx + rPadMid * bx - spread * wx,
                y: cy + rPadMid * by - spread * wy,
            },
            {
                x: cx + rPadMid * bx + spread * wx,
                y: cy + rPadMid * by + spread * wy,
            },
            { x: cx + rPadOuter * bx, y: cy + rPadOuter * by },
        ];

        const badgeR = rWedgeOuter - 0.1 * d;
        const badgePos: RadialPoint = {
            x: cx + badgeR * bx,
            y: cy + badgeR * by,
        };

        const cA = curr.pt(rIn, -1.5 * d);
        const cB = curr.pt(rIn, 1.5 * d);
        const centerTriangle = `${cA.x.toFixed(3)},${cA.y.toFixed(3)} ${cB.x.toFixed(3)},${cB.y.toFixed(3)} ${cx},${cy}`;
        const finishPoint = curr.pt(rIn * 0.56, 0);

        const laneCells: { x: number; y: number; angleDeg: number }[] = [];
        for (let t = 3; t >= 0; t--) {
            const lp = curr.pt(rIn + (t + 0.5) * d, 0);
            laneCells.push({
                x: lp.x,
                y: lp.y,
                angleDeg: curr.angleDeg,
            });
        }

        wedges.push({
            color,
            outerPath,
            innerPath,
            basePads,
            badgePos,
            centerTriangle,
            finishPoint,
            laneCells,
        });
    }

    const tokenSizePercent =
        arms === 5 ? 5.2 : arms === 6 ? 4.9 : 4.6;
    const padSizePercent =
        arms === 5 ? 7.6 : arms === 6 ? 7.0 : 6.4;

    const spec: BoardSpec = {
        arms,
        isRadial: true,
        sectorLength,
        trackLength,
        lastTrackPosition,
        firstLanePosition,
        finishPosition,
        safeIndices,
        starts,
        cellSizePercent: d,
        tokenSizePercent,
        padSizePercent,
        trackCells,
        wedges,
        centerRadius: rIn * 0.28,
    };

    RADIAL_SPEC_CACHE.set(arms, spec);

    return spec;
}

const CLASSIC_SPEC: BoardSpec = {
    arms: 4,
    isRadial: false,
    sectorLength: 13,
    trackLength: TRACK_LENGTH,
    lastTrackPosition: LAST_TRACK_POSITION,
    firstLanePosition: FIRST_LANE_POSITION,
    finishPosition: FINISH_POSITION,
    safeIndices: SAFE_TRACK_INDICES,
    starts: {
        red: 0,
        green: 13,
        yellow: 26,
        blue: 39,
    },
    cellSizePercent: 100 / 15,
    tokenSizePercent: 5.9,
    padSizePercent: 9.4,
    trackCells: [],
    wedges: [],
    centerRadius: 0,
};

export function getBoardSpec(
    order: PlayerColor[],
    explicitArms?: number | null,
): BoardSpec {
    const arms = resolveBoardArms(order, explicitArms);
    if (arms >= 5 && arms <= 7) {
        return buildRadialSpec(arms as 5 | 6 | 7);
    }

    return CLASSIC_SPEC;
}

export function boardTokenPoint(
    spec: BoardSpec,
    color: PlayerColor,
    position: number,
    tokenIndex: number,
): Cell {
    if (!spec.isRadial) {
        return tokenPoint(color, position, tokenIndex);
    }

    const wedge = spec.wedges.find((item) => item.color === color);
    const startIndex = spec.starts[color] ?? 0;

    if (!wedge) {
        return { row: 50, col: 50 };
    }

    if (position === BASE_POSITION) {
        const pad = wedge.basePads[tokenIndex] ?? wedge.basePads[0];

        return { row: pad.y, col: pad.x };
    }

    if (position >= spec.finishPosition) {
        return { row: wedge.finishPoint.y, col: wedge.finishPoint.x };
    }

    if (position <= spec.lastTrackPosition) {
        const cell = spec.trackCells[(startIndex + position) % spec.trackLength];

        return { row: cell.y, col: cell.x };
    }

    const laneCell =
        wedge.laneCells[position - spec.firstLanePosition] ??
        wedge.laneCells[wedge.laneCells.length - 1];

    return { row: laneCell.y, col: laneCell.x };
}

export function boardAbsoluteTrackIndex(
    spec: BoardSpec,
    color: PlayerColor,
    position: number,
): number | null {
    if (position < 0 || position > spec.lastTrackPosition) {
        return null;
    }

    const startIndex = spec.starts[color];
    if (startIndex === undefined) {
        return null;
    }

    return (startIndex + position) % spec.trackLength;
}

export function isBoardSafeIndex(
    spec: BoardSpec,
    index: number | null,
): boolean {
    return index !== null && spec.safeIndices.has(index);
}
