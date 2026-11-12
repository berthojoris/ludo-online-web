import { PLAYER_CONFIG, PlayerColor } from '@/lib/ludo';

type PlayerCardProps = {
    color: PlayerColor;
    name: string;
    role: 'You' | 'Rival' | 'Opponent' | 'Host' | 'Guest';
    subtitle: string;
    active: boolean;
    finished: number;
    className?: string;
};

export default function PlayerCard({
    color,
    name,
    role,
    subtitle,
    active,
    finished,
    className = '',
}: PlayerCardProps) {
    const palette = PLAYER_CONFIG[color].palette;

    return (
        <div
            className={`relative flex w-full items-center gap-3 rounded-[20px] border bg-white px-3 py-2.5 shadow-card transition-all duration-200 sm:px-4 sm:py-3 ${
                active
                    ? 'border-transparent'
                    : 'border-line/80 opacity-95'
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
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-sm font-bold"
                style={{
                    background: palette.soft,
                    color: palette.text,
                    boxShadow: `inset 0 0 0 1px ${palette.base}2e`,
                }}
            >
                {name.charAt(0).toUpperCase()}
                <span
                    className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
                    style={{ background: palette.base }}
                />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-ink">
                        {name}
                    </p>
                    <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                        style={{
                            background: palette.soft,
                            color: palette.text,
                        }}
                    >
                        {role}
                    </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                    {subtitle}
                </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                <div
                    className="flex items-center gap-1"
                    role="img"
                    aria-label={`${finished} of 4 tokens home`}
                >
                    {[0, 1, 2, 3].map((index) => (
                        <span
                            key={index}
                            className="h-2 w-2 rounded-full transition-colors"
                            style={{
                                background:
                                    index < finished
                                        ? palette.base
                                        : '#e4e8ee',
                            }}
                        />
                    ))}
                </div>
                {active && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success-ink">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                        </span>
                        Playing
                    </span>
                )}
            </div>
        </div>
    );
}
