type DiceProps = {
    value: number;
    rolling?: boolean;
    className?: string;
};

const PIPS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

export default function Dice({
    value,
    rolling = false,
    className = 'h-14 w-14',
}: DiceProps) {
    const activePips = PIPS[value] ?? PIPS[1];

    return (
        <div
            role="img"
            aria-label={`Dadu menunjukkan ${value}`}
            className={`dice-face relative rounded-[24%] ${
                rolling ? 'animate-dice-tumble' : ''
            } ${className}`}
        >
            <div className="absolute inset-[13%] grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, index) => (
                    <span
                        key={index}
                        className="flex items-center justify-center"
                    >
                        {activePips.includes(index) && (
                            <span className="bg-ink h-[58%] w-[58%] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)]" />
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
}
