import { PLAYER_CONFIG, PlayerColor } from '@/lib/ludo';

type PlayerCardProps = {
    color: PlayerColor;
    name: string;
    role: 'Kamu' | 'Lawan' | 'Tuan rumah' | 'Tamu';
    subtitle: string;
    active: boolean;
    finished: number;
    compact?: boolean;
    className?: string;
};

export default function PlayerCard({
    color,
    name,
    role,
    subtitle,
    active,
    finished,
    compact = false,
    className = '',
}: PlayerCardProps) {
    const palette = PLAYER_CONFIG[color].palette;

    return (
        <div
            className={`shadow-card relative flex w-full items-center border bg-white transition-all duration-200 ${
                compact
                    ? 'gap-2.5 rounded-[16px] px-2.5 py-1.5 sm:px-3'
                    : 'gap-3 rounded-[20px] px-3 py-2.5 sm:px-4 sm:py-3'
            } ${
                active ? 'border-transparent' : 'border-line/80 opacity-95'
            } ${className}`}
            style={
                active
                    ? {
                          boxShadow: `0 0 0 2px ${palette.base}40, 0 10px 26px -18px rgba(32,43,58,0.45)`,
                      }
                    : undefined
            }
        >
            <div
                className={`relative grid shrink-0 place-items-center font-bold ${
                    compact
                        ? 'h-8 w-8 rounded-[11px] text-xs'
                        : 'h-10 w-10 rounded-[14px] text-sm'
                }`}
                style={{
                    background: palette.soft,
                    color: palette.text,
                    boxShadow: `inset 0 0 0 1px ${palette.base}2e`,
                }}
            >
                {name.charAt(0).toUpperCase()}
                <span
                    className={`absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-white ${
                        compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
                    }`}
                    style={{ background: palette.base }}
                />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <p
                        className={`text-ink truncate font-semibold ${
                            compact ? 'text-xs sm:text-sm' : 'text-sm'
                        }`}
                    >
                        {name}
                    </p>
                    <span
                        className={`shrink-0 rounded-full font-bold tracking-[0.08em] uppercase ${
                            compact
                                ? 'px-1.5 py-px text-[8px]'
                                : 'px-1.5 py-0.5 text-[9px]'
                        }`}
                        style={{
                            background: palette.soft,
                            color: palette.text,
                        }}
                    >
                        {role}
                    </span>
                </div>
                <p
                    className={`text-ink-muted truncate ${
                        compact
                            ? 'mt-0.5 text-[10px] leading-3'
                            : 'mt-0.5 text-[11px]'
                    }`}
                >
                    {subtitle}
                </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                <div
                    className="flex items-center gap-1"
                    role="img"
                    aria-label={`${finished} dari 4 bidak di garis akhir`}
                >
                    {[0, 1, 2, 3].map((index) => (
                        <span
                            key={index}
                            className={`rounded-full transition-colors ${
                                compact ? 'h-1.5 w-1.5' : 'h-2 w-2'
                            }`}
                            style={{
                                background:
                                    index < finished ? palette.base : '#e4e8ee',
                            }}
                        />
                    ))}
                </div>
                {active && (
                    <span
                        className={`bg-success/10 text-success-ink ml-0.5 inline-flex items-center gap-1 rounded-full font-semibold ${
                            compact
                                ? 'px-1.5 py-0.5 text-[9px]'
                                : 'ml-1 px-2 py-1 text-[10px]'
                        }`}
                    >
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                            <span className="bg-success relative inline-flex h-1.5 w-1.5 rounded-full" />
                        </span>
                        Bermain
                    </span>
                )}
            </div>
        </div>
    );
}
