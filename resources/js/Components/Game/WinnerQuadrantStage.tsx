import {
    CharacterId,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
} from '@/lib/ludo';
import { memo } from 'react';

type WinnerQuadrantStageProps = {
    color: PlayerColor;
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

/**
 * Celebratory WINNER stage rendered inside the 1st-place player's home
 * quadrant. Adapts its stage palette and 4 pedestal pions to the winning
 * player's character base color.
 */
const WinnerQuadrantStage = memo(function WinnerQuadrantStage({
    color,
    character,
    playerName,
}: WinnerQuadrantStageProps) {
    const charConfig = getCharacterConfig(character, color);
    const palette = PLAYER_CONFIG[charConfig.accentColor].palette;
    const displayName = playerName?.trim() || charConfig.name;
    const uid = `winner-${color}`;

    return (
        <div
            className="winner-stage pointer-events-none absolute inset-0 z-[4] overflow-hidden rounded-[8%]"
            aria-label={`Juara 1: ${displayName}`}
            style={{
                background: `radial-gradient(circle at 50% 42%, ${palette.light} 0%, ${palette.base} 52%, ${palette.dark} 100%)`,
                boxShadow: `inset 0 0 0 2.5px #fde68a, inset 0 0 0 4.5px ${palette.dark}b3, 0 0 18px ${palette.base}66`,
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
                        <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.46" />
                        <stop offset="55%" stopColor={palette.light} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={palette.dark} stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={`${uid}-gold`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                    <linearGradient id={`${uid}-arch`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={palette.dark} stopOpacity="0.45" />
                        <stop offset="100%" stopColor={palette.dark} stopOpacity="0.72" />
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
                    stroke={`url(#${uid}-gold)`}
                    strokeWidth="3"
                />
                <path
                    d="M 30 186 L 30 74 A 70 56 0 0 1 170 74 L 170 186"
                    fill="none"
                    stroke="rgba(254, 240, 138, 0.45)"
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
                            stroke={`url(#${uid}-gold)`}
                            strokeWidth="1.4"
                        />
                        <path
                            d={`M ${banner.crownX - 4} 80 L ${banner.crownX - 3} 74 L ${banner.crownX} 77 L ${banner.crownX + 3} 74 L ${banner.crownX + 4} 80 Z`}
                            fill="#fde047"
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
                    stroke={`url(#${uid}-gold)`}
                    strokeWidth="2.4"
                />
                <ellipse
                    cx="100"
                    cy="178"
                    rx="74"
                    ry="17"
                    fill={palette.base}
                    stroke="rgba(254, 240, 138, 0.5)"
                    strokeWidth="1"
                />

                {/* Left & right golden balustrades */}
                <g stroke={`url(#${uid}-gold)`} strokeWidth="2" fill="none">
                    <path d="M 8 152 L 32 162 M 8 164 L 32 174 M 12 154 V 184 M 22 158 V 184 M 31 162 V 184" />
                    <path d="M 192 152 L 168 162 M 192 164 L 168 174 M 188 154 V 184 M 178 158 V 184 M 169 162 V 184" />
                </g>

                {/* Sparkles */}
                {SPARKLES.map((s, idx) => (
                    <path
                        key={idx}
                        d="M 0 -5.5 L 1.4 -1.4 L 5.5 0 L 1.4 1.4 L 0 5.5 L -1.4 1.4 L -5.5 0 L -1.4 -1.4 Z"
                        fill="#fef9c3"
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
                        fill={c.fill}
                        opacity="0.85"
                        transform={`translate(${c.x}, ${c.y}) rotate(${c.rotate})`}
                    />
                ))}
            </svg>

            {/* Top Crown + WINNER Ribbon */}
            <div className="relative z-[2] flex flex-col items-center pt-[2.5%]">
                <svg
                    viewBox="0 0 48 24"
                    className="-mb-[3%] h-[clamp(10px,3.3cqw,20px)] w-auto drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
                    aria-hidden="true"
                >
                    <path
                        d="M 6 20 L 3 7 L 14 13 L 24 3 L 34 13 L 45 7 L 42 20 Z"
                        fill="#fde047"
                        stroke="#b45309"
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                    <circle cx="24" cy="13" r="3" fill={palette.base} stroke="#fef08a" strokeWidth="1" />
                    <circle cx="3" cy="6.5" r="2" fill="#fef08a" />
                    <circle cx="24" cy="2.5" r="2.2" fill="#fef08a" />
                    <circle cx="45" cy="6.5" r="2" fill="#fef08a" />
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
                            stroke="#fde047"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                        />
                        <circle cx="7" cy="6" r="2" fill="#facc15" />
                        <circle cx="6" cy="12" r="2" fill="#facc15" />
                        <circle cx="9" cy="17" r="2" fill="#facc15" />
                    </svg>

                    <div
                        className="rounded-full border-[1.5px] border-[#fde047] px-[clamp(7px,2.2cqw,14px)] py-[clamp(1px,0.35cqw,3px)] font-black tracking-[0.09em] text-white uppercase shadow-[0_2px_8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]"
                        style={{
                            background: `linear-gradient(180deg, ${palette.base} 0%, ${palette.dark} 100%)`,
                            fontSize: 'clamp(7.5px, 2.45cqw, 14px)',
                            lineHeight: 1.2,
                            textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                        }}
                    >
                        WINNER
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
                            stroke="#fde047"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                        />
                        <circle cx="7" cy="6" r="2" fill="#facc15" />
                        <circle cx="6" cy="12" r="2" fill="#facc15" />
                        <circle cx="9" cy="17" r="2" fill="#facc15" />
                    </svg>
                </div>
            </div>

            {/* 2x2 Golden Pedestals + 4 Winner Character Pions */}
            <div className="relative z-[2] mx-auto grid h-[56%] w-[74%] grid-cols-2 grid-rows-2 place-items-center gap-x-[6%] gap-y-[2%] pt-[2%]">
                {PEDESTAL_SLOTS.map((slot) => (
                    <div
                        key={slot}
                        className="relative flex h-full w-full items-end justify-center pb-[12%]"
                    >
                        {/* Warm glow beneath pedestal */}
                        <span
                            aria-hidden="true"
                            className="absolute bottom-[6%] h-[28%] w-[86%] rounded-full blur-[3px]"
                            style={{
                                background:
                                    'radial-gradient(circle, rgba(254,240,138,0.85) 0%, rgba(245,158,11,0.35) 60%, transparent 100%)',
                            }}
                        />
                        {/* Golden pedestal base */}
                        <span
                            aria-hidden="true"
                            className="absolute bottom-[9%] h-[22%] w-[78%] rounded-[50%] border border-[#fef08a] shadow-[0_2px_4px_rgba(0,0,0,0.38)]"
                            style={{
                                background:
                                    'linear-gradient(180deg, #fef08a 0%, #f59e0b 55%, #b45309 100%)',
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
            <div className="absolute inset-x-[8%] bottom-[4.5%] z-[3] flex items-center justify-center gap-[2%]">
                <svg
                    viewBox="0 0 18 16"
                    className="h-[clamp(8px,2.2cqw,13px)] w-auto shrink-0"
                    aria-hidden="true"
                >
                    <path
                        d="M 15 14 C 7 12, 4 7, 7 2 C 9 6, 11 9, 15 12"
                        fill="none"
                        stroke="#fde047"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                    />
                </svg>

                <div
                    className="flex max-w-[82%] items-center gap-[4%] rounded-full border-[1.5px] border-[#f59e0b] px-[clamp(6px,2cqw,12px)] py-[clamp(1px,0.3cqw,2.5px)] shadow-[0_2px_6px_rgba(0,0,0,0.28)]"
                    style={{
                        background:
                            'linear-gradient(180deg, #fffdf5 0%, #fef3c7 100%)',
                    }}
                >
                    <svg
                        viewBox="0 0 24 18"
                        className="h-[clamp(7px,1.9cqw,11px)] w-auto shrink-0"
                        aria-hidden="true"
                    >
                        <path
                            d="M 3 15 L 1.5 5 L 8 9.5 L 12 2.5 L 16 9.5 L 22.5 5 L 21 15 Z"
                            fill="#f59e0b"
                            stroke="#b45309"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                        />
                    </svg>
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
                        stroke="#fde047"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        </div>
    );
});

export default WinnerQuadrantStage;
