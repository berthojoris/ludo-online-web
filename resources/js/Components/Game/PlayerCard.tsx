import {
    CharacterId,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
} from '@/lib/ludo';

type PlayerCardProps = {
    color: PlayerColor;
    name: string;
    character?: CharacterId | string | null;
    role: 'Kamu' | 'Lawan' | 'Host' | 'Tamu' | 'Komputer';
    subtitle: string;
    active: boolean;
    finished: number;
    countdownSeconds?: number | null;
    size?: 'md' | 'sm';
    className?: string;
};

export default function PlayerCard({
    color,
    name,
    character,
    role,
    subtitle,
    active,
    finished,
    countdownSeconds,
    size = 'md',
    className = '',
}: PlayerCardProps) {
    const palette = PLAYER_CONFIG[color].palette;
    const charConfig = getCharacterConfig(character, color);
    const compact = size === 'sm';

    return (
        <div
            className={`flex min-w-0 items-center transition-colors duration-200 ${
                compact
                    ? 'gap-2 px-2.5 py-2.5'
                    : 'gap-3 px-4 py-3 [@media(max-height:700px)]:py-2'
            } ${
                active ? 'animate-card-nudge' : 'bg-white/95 opacity-[0.92]'
            } ${className}`}
            style={
                active
                    ? {
                          background: palette.soft,
                          boxShadow: `inset 0 0 0 1px ${palette.base}45, inset 3px 0 0 0 ${palette.base}`,
                      }
                    : undefined
            }
        >
            <div
                className={`relative shrink-0 rounded-full p-[2px] ${
                    compact ? 'h-8 w-8' : 'h-11 w-11'
                }`}
                style={{
                    background: `linear-gradient(135deg, ${palette.base}, ${palette.dark})`,
                    boxShadow: active
                        ? `0 0 0 2px #ffffff, 0 0 0 4px ${palette.base}55`
                        : `0 2px 6px ${palette.base}33`,
                }}
            >
                <img
                    src={charConfig.image}
                    alt={charConfig.name}
                    width={compact ? 32 : 44}
                    height={compact ? 32 : 44}
                    className="h-full w-full rounded-full bg-white object-cover"
                />
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
                        className={`text-ink truncate font-bold ${
                            compact ? 'text-xs' : 'text-sm'
                        }`}
                    >
                        {name}
                    </p>
                    {!compact && (
                        <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.06em] uppercase"
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
                            : 'mt-0.5 text-[11px] leading-4'
                    }`}
                >
                    {subtitle}
                    {!compact ? ` · ${charConfig.name}` : ''}
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
                                        : `inset 0 0 0 1.5px ${palette.base}65`,
                            }}
                        />
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    {active &&
                        countdownSeconds !== null &&
                        countdownSeconds !== undefined && (
                            <span
                                className={`rounded-full px-1.5 py-0.5 font-extrabold tabular-nums ${
                                    compact ? 'text-[9px]' : 'text-[10px]'
                                } ${
                                    countdownSeconds <= 5
                                        ? 'bg-danger/12 text-danger animate-pulse'
                                        : countdownSeconds <= 10
                                          ? 'bg-amber-500/15 text-amber-700'
                                          : 'bg-white/90 text-ink shadow-2xs'
                                }`}
                                aria-label={`Sisa waktu ${countdownSeconds} detik`}
                            >
                                00:{String(countdownSeconds).padStart(2, '0')}
                            </span>
                        )}
                    <p
                        className={`font-extrabold tabular-nums ${
                            compact ? 'text-[9px]' : 'text-[10px]'
                        }`}
                        aria-hidden="true"
                    >
                        <span style={{ color: palette.text }}>{finished}</span>
                        <span className="text-ink-muted">/4</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
