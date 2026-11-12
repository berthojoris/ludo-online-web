import { PLAYER_CONFIG, PlayerColor } from '@/lib/ludo';

type PlayerCardProps = {
    color: PlayerColor;
    name: string;
    role: 'Kamu' | 'Lawan' | 'Tuan rumah' | 'Tamu';
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
            className={`shadow-card relative flex w-full items-center gap-3 rounded-[20px] border bg-white px-3 py-2.5 transition-all duration-200 sm:px-4 sm:py-3 ${
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
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-sm font-bold"
                style={{
                    background: palette.soft,
                    color: palette.text,
                    boxShadow: `inset 0 0 0 1px ${palette.base}2e`,
                }}
            >
                {name.charAt(0).toUpperCase()}
                <span
                    className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
                    style={{ background: palette.base }}
                />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="text-ink truncate text-sm font-semibold">
                        {name}
                    </p>
                    <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] uppercase"
                        style={{
                            background: palette.soft,
                            color: palette.text,
                        }}
                    >
                        {role}
                    </span>
                </div>
                <p className="text-ink-muted mt-0.5 truncate text-[11px]">
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
                            className="h-2 w-2 rounded-full transition-colors"
                            style={{
                                background:
                                    index < finished ? palette.base : '#e4e8ee',
                            }}
                        />
                    ))}
                </div>
                {active && (
                    <span className="bg-success/10 text-success-ink ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold">
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
