import type { Phase } from '@/features/game/matchTypes';

export const TURN_TIMEOUT_SECONDS = 10;

export function formatTurnTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function TurnCountdownHud({
    secondsLeft,
    totalSeconds,
    phase,
    playerName,
    isMyTurn,
    accentColor,
}: {
    secondsLeft: number;
    totalSeconds: number;
    phase: Phase;
    playerName: string;
    isMyTurn: boolean;
    accentColor: string;
}) {
    const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
    const radius = 8;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - progress);
    const isCritical = secondsLeft <= 2;
    const isWarning = secondsLeft > 2 && secondsLeft <= 5;

    const ringColor = isCritical
        ? '#dc2626'
        : isWarning
          ? '#d97706'
          : accentColor;

    const pillTone = isCritical
        ? 'border-red-300 bg-red-50/95 text-red-700 animate-pulse'
        : isWarning
          ? 'border-amber-300 bg-amber-50/95 text-amber-800'
          : 'border-slate-200/90 bg-white/95 text-ink';

    const phaseText = phase === 'choosing' ? 'Pilih Bidak' : 'Lempar Dadu';
    const actorText = isMyTurn ? 'Giliranmu' : playerName;

    return (
        <div
            role="timer"
            aria-live="off"
            aria-label={`Sisa waktu ${phaseText} ${actorText}: ${secondsLeft} detik`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 shadow-xs backdrop-blur-md transition-colors sm:gap-2 sm:px-3 sm:py-1 ${pillTone}`}
        >
            <svg
                viewBox="0 0 20 20"
                className="h-4.5 w-4.5 shrink-0 -rotate-90 sm:h-5 sm:w-5"
                aria-hidden="true"
            >
                <circle
                    cx="10"
                    cy="10"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.14}
                    strokeWidth="2.4"
                />
                <circle
                    cx="10"
                    cy="10"
                    r={radius}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-[stroke-dashoffset,stroke] duration-300 ease-linear"
                />
            </svg>
            <span
                className="hidden h-2 w-2 shrink-0 rounded-full sm:inline-block"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
            />
            <span className="hidden max-w-[110px] truncate text-[11px] font-semibold lg:inline">
                {actorText}
            </span>
            <span className="text-ink-muted hidden text-[10px] font-medium sm:inline lg:before:mr-1 lg:before:content-['·']">
                {phaseText}
            </span>
            <span className="text-[11px] font-extrabold tracking-tight tabular-nums sm:text-xs">
                {formatTurnTimer(secondsLeft)}
            </span>
        </div>
    );
}
