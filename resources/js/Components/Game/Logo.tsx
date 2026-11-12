type LogoProps = {
    className?: string;
    withWordmark?: boolean;
    compact?: boolean;
};

export default function Logo({
    className = 'h-9 w-9',
    withWordmark = false,
    compact = false,
}: LogoProps) {
    return (
        <span className="inline-flex items-center gap-2.5">
            <svg
                className={className}
                viewBox="0 0 40 40"
                fill="none"
                aria-hidden="true"
            >
                <rect width="40" height="40" rx="12" fill="#202B3A" />
                <rect
                    x="5"
                    y="5"
                    width="14"
                    height="14"
                    rx="4.5"
                    fill="#F04452"
                />
                <rect
                    x="21"
                    y="5"
                    width="14"
                    height="14"
                    rx="4.5"
                    fill="#20C66B"
                />
                <rect
                    x="5"
                    y="21"
                    width="14"
                    height="14"
                    rx="4.5"
                    fill="#2F80ED"
                />
                <rect
                    x="21"
                    y="21"
                    width="14"
                    height="14"
                    rx="4.5"
                    fill="#F4B915"
                />
                <circle
                    cx="12"
                    cy="12"
                    r="2.4"
                    fill="white"
                    fillOpacity=".92"
                />
                <circle
                    cx="28"
                    cy="12"
                    r="2.4"
                    fill="white"
                    fillOpacity=".92"
                />
                <circle
                    cx="12"
                    cy="28"
                    r="2.4"
                    fill="white"
                    fillOpacity=".92"
                />
                <circle
                    cx="28"
                    cy="28"
                    r="2.4"
                    fill="white"
                    fillOpacity=".92"
                />
            </svg>
            {withWordmark && (
                <span className="flex items-baseline gap-2">
                    <span className="text-ink text-[17px] font-semibold tracking-tight">
                        Ludo Arena
                    </span>
                    {!compact && (
                        <span className="bg-brand/10 text-brand-ink rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em]">
                            BETA
                        </span>
                    )}
                </span>
            )}
        </span>
    );
}
