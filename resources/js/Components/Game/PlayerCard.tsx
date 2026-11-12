import { PLAYER_CONFIG, PlayerColor } from '@/lib/ludo';

type PlayerCardProps = {
    color: PlayerColor;
    name: string;
    role: 'Kamu' | 'Lawan' | 'Tuan rumah' | 'Tamu';
    subtitle: string;
    active: boolean;
    finished: number;
    size?: 'md' | 'sm';
    className?: string;
};

export default function PlayerCard({
    color,
    name,
    role,
    subtitle,
    active,
    finished,
    size = 'md',
    className = '',
}: PlayerCardProps) {
    const palette = PLAYER_CONFIG[color].palette;
    const compact = size === 'sm';

    return (
        <div
            className={`flex min-w-0 items-center transition-colors duration-200 ${
                compact ? 'gap-2 px-2.5 py-3' : 'gap-3 px-4 py-3.5'
            } ${
                active ? 'animate-card-nudge' : 'bg-white opacity-[0.85]'
            } ${className}`}
            style={
                active
                    ? {
                          background: palette.soft,
                          boxShadow: `inset 0 0 0 3px ${palette.base}, inset 4px 0 0 0 ${palette.dark}`,
                      }
                    : undefined
            }
        >
            <div
                className={`relative grid shrink-0 place-items-center font-bold ${
                    compact
                        ? 'h-8 w-8 rounded-[10px] text-[11px]'
                        : 'h-11 w-11 rounded-[14px] text-[15px]'
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
                        compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'
                    }`}
                    style={{ background: palette.base }}
                />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <p
                        className={`text-ink truncate font-semibold ${
                            compact ? 'text-xs' : 'text-sm'
                        }`}
                    >
                        {name}
                    </p>
                    {!compact && (
                        <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] uppercase"
                            style={{
                                background: palette.soft,
                                color: palette.text,
                                boxShadow: `inset 0 0 0 1px ${palette.base}40`,
                            }}
                        >
                            {role}
                        </span>
                    )}
                </div>
                <p
                    className={`text-ink-muted truncate ${
                        compact
                            ? 'mt-0.5 text-[10px] leading-3'
                            : 'mt-1 text-[11px] leading-4'
                    }`}
                >
                    {subtitle}
                </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
                <div
                    className={
                        compact
                            ? 'flex items-center gap-[3px]'
                            : 'grid grid-cols-2 gap-1'
                    }
                    role="img"
                    aria-label={`${finished} dari 4 bidak di garis akhir`}
                >
                    {[0, 1, 2, 3].map((index) => (
                        <span
                            key={index}
                            className={`rounded-full transition-colors duration-200 ${
                                compact ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'
                            }`}
                            style={{
                                background:
                                    index < finished ? palette.base : '#ffffff',
                                boxShadow:
                                    index < finished
                                        ? undefined
                                        : `inset 0 0 0 1px ${palette.base}45`,
                            }}
                        />
                    ))}
                </div>
                <p
                    className={`font-bold tabular-nums ${
                        compact ? 'text-[9px]' : 'text-[10px]'
                    }`}
                    aria-hidden="true"
                >
                    <span style={{ color: palette.text }}>{finished}</span>
                    <span className="text-ink-muted">/4</span>
                </p>
            </div>
        </div>
    );
}
