import { ShuffleIcon } from '@/Components/Game/Icons';
import type { PlayerCount } from '@/lib/ludo';

const PLAYER_COUNTS: PlayerCount[] = [2, 3, 4, 5, 6, 7];

export default function RoomSettingsSummary({
    playerCount,
    isHost,
    pending,
    randomizing = false,
    onSelectPlayerCount,
    vsComputer,
    onSelectOpponent,
    onRandomize,
}: {
    playerCount: PlayerCount;
    isHost: boolean;
    pending: boolean;
    randomizing?: boolean;
    onSelectPlayerCount: (count: PlayerCount) => void;
    vsComputer: boolean;
    onSelectOpponent: (computer: boolean) => void;
    onRandomize?: () => void;
}) {
    const controlsDisabled = !isHost || pending || randomizing;

    return (
        <>
            <fieldset
                className="mb-3"
                disabled={controlsDisabled}
                aria-busy={pending || randomizing}
            >
                <legend className="text-ink-muted text-xs font-medium">
                    Lawan
                </legend>
                <div className="segmented mt-1.5 grid grid-cols-2">
                    <button
                        type="button"
                        className="segmented-item min-h-11 px-2 text-xs"
                        aria-pressed={!vsComputer}
                        onClick={() => onSelectOpponent(false)}
                    >
                        MANUSIA
                    </button>
                    <button
                        type="button"
                        className="segmented-item min-h-11 px-2 text-xs"
                        aria-pressed={vsComputer}
                        onClick={() => onSelectOpponent(true)}
                    >
                        VS COMPUTER
                    </button>
                </div>
                {vsComputer && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-ink-muted text-xs">
                            Level Computer: MEDIUM
                        </p>
                        {isHost && onRandomize && (
                            <button
                                type="button"
                                disabled={controlsDisabled}
                                aria-busy={randomizing}
                                onClick={onRandomize}
                                className="btn btn-secondary btn-sm shrink-0 gap-1.5 px-2.5 text-xs"
                            >
                                {randomizing ? (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                        />
                                        <span>Mengacak…</span>
                                    </>
                                ) : (
                                    <>
                                        <ShuffleIcon className="h-3.5 w-3.5 shrink-0" />
                                        <span>Random</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </fieldset>
            <div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-muted block text-xs font-medium">
                        Kapasitas pemain
                    </span>
                    {!isHost && (
                        <span className="text-ink-muted text-[10px] font-medium">
                            Diatur host
                        </span>
                    )}
                </div>
                <div className="segmented mt-1.5 grid grid-cols-3">
                    {PLAYER_COUNTS.map((count) => (
                        <button
                            key={count}
                            type="button"
                            disabled={controlsDisabled}
                            onClick={() => onSelectPlayerCount(count)}
                            aria-pressed={playerCount === count}
                            className="segmented-item px-1 text-[11px] sm:text-xs"
                        >
                            {count} Pemain
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
