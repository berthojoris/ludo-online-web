import {
    CharacterId,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
} from '@/lib/ludo';
import { memo } from 'react';

type WinnerQuadrantStageProps = {
    color: PlayerColor;
    rank?: number;
    character?: CharacterId | string | null;
    playerName?: string;
};

const PEDESTAL_SLOTS = [0, 1, 2, 3] as const;

const SPARKLES = [
    { x: 34, y: 42, scale: 1 },
    { x: 168, y: 44, scale: 0.9 },
    { x: 100, y: 92, scale: 1.15 },
    { x: 48, y: 140, scale: 0.75 },
    { x: 152, y: 138, scale: 0.85 },
];

const CONFETTI = [
    { x: 26, y: 74, rotate: -24, fill: '#fde047' },
    { x: 174, y: 78, rotate: 28, fill: '#fef08a' },
    { x: 40, y: 112, rotate: 18, fill: '#ffffff' },
    { x: 162, y: 116, rotate: -22, fill: '#fde047' },
    { x: 100, y: 52, rotate: 12, fill: '#fef08a' },
];

type RankTheme = {
    trimLight: string;
    trimMid: string;
    trimBase: string;
    trimDark: string;
    medalBg: string;
    medalText: string;
    medalTextShadow?: string;
    glowBg: string;
    pedestalBg: string;
    nameBg: string;
};

function getRankTheme(rank: number): RankTheme {
    if (rank === 1) {
        return {
            trimLight: '#fef9c3',
            trimMid: '#fde047',
            trimBase: '#f59e0b',
            trimDark: '#b45309',
            medalBg:
                'linear-gradient(180deg, #fef9c3 0%, #fde047 38%, #f59e0b 78%, #b45309 100%)',
            medalText: '#78350f',
            glowBg: 'radial-gradient(circle, rgba(254,240,138,0.85) 0%, rgba(245,158,11,0.35) 60%, transparent 100%)',
            pedestalBg:
                'linear-gradient(180deg, #fef08a 0%, #f59e0b 55%, #b45309 100%)',
            nameBg: 'linear-gradient(180deg, #fffdf5 0%, #fef3c7 100%)',
        };
    }

    if (rank === 2) {
        return {
            trimLight: '#ffffff',
            trimMid: '#e2e8f0',
            trimBase: '#94a3b8',
            trimDark: '#475569',
            medalBg:
                'linear-gradient(180deg, #ffffff 0%, #e2e8f0 42%, #94a3b8 82%, #475569 100%)',
            medalText: '#1e293b',
            glowBg: 'radial-gradient(circle, rgba(241,245,249,0.85) 0%, rgba(148,163,184,0.35) 60%, transparent 100%)',
            pedestalBg:
                'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 55%, #64748b 100%)',
            nameBg: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
        };
    }

    if (rank === 3) {
        return {
            trimLight: '#ffedd5',
            trimMid: '#fdba74',
            trimBase: '#d97706',
            trimDark: '#7c2d12',
            medalBg:
                'linear-gradient(180deg, #ffedd5 0%, #fdba74 38%, #d97706 78%, #7c2d12 100%)',
            medalText: '#ffffff',
            medalTextShadow: '0 1px 2px rgba(67,20,7,0.75)',
            glowBg: 'radial-gradient(circle, rgba(254,215,170,0.85) 0%, rgba(217,119,6,0.35) 60%, transparent 100%)',
            pedestalBg:
                'linear-gradient(180deg, #fed7aa 0%, #d97706 55%, #7c2d12 100%)',
            nameBg: 'linear-gradient(180deg, #fffaf5 0%, #ffedd5 100%)',
        };
    }

    return {
        trimLight: '#f8fafc',
        trimMid: '#cbd5e1',
        trimBase: '#64748b',
        trimDark: '#334155',
        medalBg:
            'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 55%, #64748b 100%)',
        medalText: '#1e293b',
        glowBg: 'radial-gradient(circle, rgba(241,245,249,0.75) 0%, rgba(100,116,139,0.3) 60%, transparent 100%)',
        pedestalBg:
            'linear-gradient(180deg, #f1f5f9 0%, #94a3b8 55%, #475569 100%)',
        nameBg: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    };
}

/**
 * Celebratory podium stage rendered inside a finished winner's home quadrant
 * (1st, 2nd, 3rd place, etc.). Uses the player's home base color palette,
 * rank-specific metallic accents, and a clear numeric rank badge.
 */
const WinnerQuadrantStage = memo(function WinnerQuadrantStage({
    color,
    rank = 1,
    character,
    playerName,
}: WinnerQuadrantStageProps) {
    const charConfig = getCharacterConfig(character, color);
    const palette = PLAYER_CONFIG[color].palette;
    const theme = getRankTheme(rank);
    const displayName = playerName?.trim() || charConfig.name;
    const uid = `winner-${color}-${rank}`;

    return (
        <div
            className="winner-stage pointer-events-none absolute inset-0 z-[4] overflow-hidden rounded-[8%]"
            aria-label={`Juara ${rank}: ${displayName}`}
            style={{
                background: `radial-gradient(circle at 50% 42%, ${palette.light} 0%, ${palette.base} 52%, ${palette.dark} 100%)`,
                boxShadow: `inset 0 0 0 2.5px ${theme.trimLight}, inset 0 0 0 4.5px ${palette.dark}cc, 0 0 18px ${palette.base}66`,
            }}
        >
            {/* Stage backdrop: sunburst rays, archway, banners, balustrades, sparkles */}
            <svg
                viewBox="0 0 200 200"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
            >
                <defs>
                    <radialGradient id={`${uid}-glow`} cx="50%" cy="46%" r="54%">
                        <stop offset="0%" stopColor={theme.trimLight} stopOpacity="0.46" />
                        <stop offset="55%" stopColor={palette.light} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={palette.dark} stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={`${uid}-trim`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={theme.trimMid} />
                        <stop offset="50%" stopColor={theme.trimBase} />
                        <stop offset="100%" stopColor={theme.trimDark} />
                    </linearGradient>
                    <linearGradient id={`${uid}-arch`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={palette.dark} stopOpacity="0.48" />
                        <stop offset="100%" stopColor={palette.dark} stopOpacity="0.76" />
                    </linearGradient>
                </defs>

                {/* Sunburst rays */}
                <g opacity="0.22" fill="#fffbeb">
                    <polygon points="100,96 72,8 128,8" />
                    <polygon points="100,96 154,18 192,48" />
                    <polygon points="100,96 192,94 192,134" />
                    <polygon points="100,96 8,48 46,18" />
                    <polygon points="100,96 8,134 8,94" />
                </g>

                <circle cx="100" cy="94" r="88" fill={`url(#${uid}-glow)`} />

                {/* Grand archway */}
                <path
                    d="M 24 186 L 24 72 A 76 62 0 0 1 176 72 L 176 186 Z"
                    fill={`url(#${uid}-arch)`}
                    stroke={`url(#${uid}-trim)`}
                    strokeWidth="3"
                />
                <path
                    d="M 30 186 L 30 74 A 70 56 0 0 1 170 74 L 170 186"
                    fill="none"
                    stroke={theme.trimLight}
                    strokeOpacity="0.45"
                    strokeWidth="1.2"
                />

                {/* Left & right hanging royal banners */}
                {[
                    { x: 11, crownX: 18 },
                    { x: 175, crownX: 182 },
                ].map((banner, idx) => (
                    <g key={idx}>
                        <path
                            d={`M ${banner.x} 60 H ${banner.x + 14} V 104 L ${banner.x + 7} 98 L ${banner.x} 104 Z`}
                            fill={palette.dark}
                            stroke={`url(#${uid}-trim)`}
                            strokeWidth="1.4"
                        />
                        <path
                            d={`M ${banner.crownX - 4} 80 L ${banner.crownX - 3} 74 L ${banner.crownX} 77 L ${banner.crownX + 3} 74 L ${banner.crownX + 4} 80 Z`}
                            fill={theme.trimMid}
                        />
                    </g>
                ))}

                {/* Stage floor dais */}
                <ellipse
                    cx="100"
                    cy="182"
                    rx="84"
                    ry="24"
                    fill={palette.dark}
                    stroke={`url(#${uid}-trim)`}
                    strokeWidth="2.4"
                />
                <ellipse
                    cx="100"
                    cy="178"
                    rx="74"
                    ry="17"
                    fill={palette.base}
                    stroke={theme.trimLight}
                    strokeOpacity="0.55"
                    strokeWidth="1"
                />

                {/* Left & right metallic balustrades */}
                <g stroke={`url(#${uid}-trim)`} strokeWidth="2" fill="none">
                    <path d="M 8 152 L 32 162 M 8 164 L 32 174 M 12 154 V 184 M 22 158 V 184 M 31 162 V 184" />
                    <path d="M 192 152 L 168 162 M 192 164 L 168 174 M 188 154 V 184 M 178 158 V 184 M 169 162 V 184" />
                </g>

                {/* Sparkles */}
                {SPARKLES.map((s, idx) => (
                    <path
                        key={idx}
                        d="M 0 -5.5 L 1.4 -1.4 L 5.5 0 L 1.4 1.4 L 0 5.5 L -1.4 1.4 L -5.5 0 L -1.4 -1.4 Z"
                        fill={theme.trimLight}
                        opacity="0.88"
                        transform={`translate(${s.x}, ${s.y}) scale(${s.scale})`}
                    />
                ))}

                {/* Confetti ribbons */}
                {CONFETTI.map((c, idx) => (
                    <rect
                        key={idx}
                        x="-3"
                        y="-1.4"
                        width="6"
                        height="2.8"
                        rx="1"
                        fill={idx % 2 === 0 ? theme.trimMid : c.fill}
                        opacity="0.85"
                        transform={`translate(${c.x}, ${c.y}) rotate(${c.rotate})`}
                    />
                ))}
            </svg>

            {/* Top-left Prominent Rank Number Medal (1, 2, 3, ...) */}
            <div
                className="absolute top-[4.5%] left-[4.5%] z-[4] flex aspect-square w-[16%] items-center justify-center rounded-full border-[1.5px] font-black tabular-nums shadow-[0_2px_6px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.75)]"
                style={{
                    background: theme.medalBg,
                    borderColor: theme.trimLight,
                    color: theme.medalText,
                    fontSize: 'clamp(9.5px, 3.1cqw, 19px)',
                    lineHeight: 1,
                    textShadow: theme.medalTextShadow,
                    boxShadow: `0 2px 6px rgba(0,0,0,0.38), 0 0 0 1px ${theme.trimDark}aa, inset 0 1px 1px rgba(255,255,255,0.75)`,
                }}
                aria-hidden="true"
            >
                {rank}
            </div>

            {/* Top Crown + Rank Ribbon */}
            <div className="relative z-[2] flex flex-col items-center pt-[2.5%]">
                <svg
                    viewBox="0 0 48 24"
                    className="-mb-[3%] h-[clamp(10px,3.3cqw,20px)] w-auto drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
                    aria-hidden="true"
                >
                    <path
                        d="M 6 20 L 3 7 L 14 13 L 24 3 L 34 13 L 45 7 L 42 20 Z"
                        fill={theme.trimMid}
                        stroke={theme.trimDark}
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                    <circle cx="24" cy="13" r="3" fill={palette.base} stroke={theme.trimLight} strokeWidth="1" />
                    <circle cx="3" cy="6.5" r="2" fill={theme.trimLight} />
                    <circle cx="24" cy="2.5" r="2.2" fill={theme.trimLight} />
                    <circle cx="45" cy="6.5" r="2" fill={theme.trimLight} />
                </svg>

                <div className="flex items-center justify-center gap-[2%]">
                    {/* Left laurel */}
                    <svg
                        viewBox="0 0 20 24"
                        className="h-[clamp(10px,3.2cqw,18px)] w-auto"
                        aria-hidden="true"
                    >
                        <path
                            d="M 16 21 C 7 18, 4 10, 8 3 C 10 8, 12 13, 16 18"
                            fill="none"
                            stroke={theme.trimMid}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                        />
                        <circle cx="7" cy="6" r="2" fill={theme.trimMid} />
                        <circle cx="6" cy="12" r="2" fill={theme.trimMid} />
                        <circle cx="9" cy="17" r="2" fill={theme.trimMid} />
                    </svg>

                    <div
                        className="rounded-full border-[1.5px] px-[clamp(7px,2.2cqw,14px)] py-[clamp(1px,0.35cqw,3px)] font-black tracking-[0.08em] text-white uppercase shadow-[0_2px_8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]"
                        style={{
                            background: `linear-gradient(180deg, ${palette.base} 0%, ${palette.dark} 100%)`,
                            borderColor: theme.trimMid,
                            fontSize: 'clamp(7.5px, 2.35cqw, 13.5px)',
                            lineHeight: 1.2,
                            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        }}
                    >
                        JUARA {rank}
                    </div>

                    {/* Right laurel */}
                    <svg
                        viewBox="0 0 20 24"
                        className="h-[clamp(10px,3.2cqw,18px)] w-auto -scale-x-100"
                        aria-hidden="true"
                    >
                        <path
                            d="M 16 21 C 7 18, 4 10, 8 3 C 10 8, 12 13, 16 18"
                            fill="none"
                            stroke={theme.trimMid}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                        />
                        <circle cx="7" cy="6" r="2" fill={theme.trimMid} />
                        <circle cx="6" cy="12" r="2" fill={theme.trimMid} />
                        <circle cx="9" cy="17" r="2" fill={theme.trimMid} />
                    </svg>
                </div>
            </div>

            {/* 2x2 Pedestals + 4 Winner Character Pions */}
            <div className="relative z-[2] mx-auto grid h-[56%] w-[74%] grid-cols-2 grid-rows-2 place-items-center gap-x-[6%] gap-y-[2%] pt-[2%]">
                {PEDESTAL_SLOTS.map((slot) => (
                    <div
                        key={slot}
                        className="relative flex h-full w-full items-end justify-center pb-[12%]"
                    >
                        {/* Glow beneath pedestal */}
                        <span
                            aria-hidden="true"
                            className="absolute bottom-[6%] h-[28%] w-[86%] rounded-full blur-[3px]"
                            style={{
                                background: theme.glowBg,
                            }}
                        />
                        {/* Metallic pedestal base */}
                        <span
                            aria-hidden="true"
                            className="absolute bottom-[9%] h-[22%] w-[78%] rounded-[50%] border shadow-[0_2px_4px_rgba(0,0,0,0.38)]"
                            style={{
                                background: theme.pedestalBg,
                                borderColor: theme.trimLight,
                            }}
                        />
                        {/* Character Pion */}
                        <img
                            src={charConfig.pion}
                            alt=""
                            draggable={false}
                            className="relative z-[1] h-[86%] w-auto max-w-[78%] object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.38)]"
                        />
                    </div>
                ))}
            </div>

            {/* Bottom Winner Name Ribbon */}
            <div className="absolute inset-x-[5%] bottom-[4.5%] z-[3] flex items-center justify-center gap-[2%]">
                <svg
                    viewBox="0 0 18 16"
                    className="h-[clamp(8px,2.2cqw,13px)] w-auto shrink-0"
                    aria-hidden="true"
                >
                    <path
                        d="M 15 14 C 7 12, 4 7, 7 2 C 9 6, 11 9, 15 12"
                        fill="none"
                        stroke={theme.trimMid}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                    />
                </svg>

                <div
                    className="flex max-w-[88%] items-center gap-[4%] rounded-full border-[1.5px] px-[clamp(6px,2cqw,12px)] py-[clamp(1px,0.3cqw,2.5px)] shadow-[0_2px_6px_rgba(0,0,0,0.28)]"
                    style={{
                        background: theme.nameBg,
                        borderColor: theme.trimBase,
                    }}
                >
                    <span
                        className="grid aspect-square h-[clamp(10px,2.5cqw,15px)] shrink-0 place-items-center rounded-full font-black tabular-nums"
                        style={{
                            background: theme.medalBg,
                            color: theme.medalText,
                            textShadow: theme.medalTextShadow,
                            fontSize: 'clamp(6.5px, 1.75cqw, 10px)',
                            lineHeight: 1,
                        }}
                        aria-hidden="true"
                    >
                        {rank}
                    </span>
                    <span
                        className="truncate font-extrabold"
                        style={{
                            color: palette.text,
                            fontSize: 'clamp(6.5px, 1.85cqw, 11.5px)',
                            lineHeight: 1.25,
                        }}
                    >
                        {displayName}
                    </span>
                </div>

                <svg
                    viewBox="0 0 18 16"
                    className="h-[clamp(8px,2.2cqw,13px)] w-auto shrink-0 -scale-x-100"
                    aria-hidden="true"
                >
                    <path
                        d="M 15 14 C 7 12, 4 7, 7 2 C 9 6, 11 9, 15 12"
                        fill="none"
                        stroke={theme.trimMid}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        </div>
    );
});

export default WinnerQuadrantStage;
