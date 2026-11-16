import { CSSProperties, useId } from 'react';

type LudoPinProps = {
    className?: string;
    style?: CSSProperties;
    characterImage?: string | null;
};

export default function LudoPin({
    className = '',
    style,
    characterImage,
}: LudoPinProps) {
    const rawId = useId();
    const clipId = `pin-clip-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    return (
        <svg
            aria-hidden="true"
            className={className}
            style={style}
            viewBox="0 0 32 40"
            fill="none"
        >
            {characterImage && (
                <defs>
                    <clipPath id={clipId}>
                        <circle cx="16" cy="15.5" r="9.2" />
                    </clipPath>
                </defs>
            )}
            <path
                d="M16 38C13.5 34.8 3 24.6 3 15.5C3 8.1 8.8 2 16 2S29 8.1 29 15.5C29 24.6 18.5 34.8 16 38Z"
                fill="white"
                stroke="var(--token-dark, #405066)"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            {characterImage ? (
                <>
                    <circle cx="16" cy="15.5" r="10.4" fill="var(--token-base)" />
                    <circle cx="16" cy="15.5" r="9.2" fill="#ffffff" />
                    <image
                        href={characterImage}
                        x="6.8"
                        y="6.3"
                        width="18.4"
                        height="18.4"
                        clipPath={`url(#${clipId})`}
                        preserveAspectRatio="xMidYMid slice"
                    />
                    <circle
                        cx="16"
                        cy="15.5"
                        r="9.2"
                        stroke="var(--token-base)"
                        strokeWidth="1.4"
                    />
                </>
            ) : (
                <>
                    <circle cx="16" cy="15.5" r="8.8" fill="var(--token-base)" />
                    <circle
                        cx="16"
                        cy="15.5"
                        r="8.8"
                        stroke="var(--token-dark)"
                        strokeWidth="1"
                    />
                    <circle
                        cx="13"
                        cy="12.5"
                        r="2.2"
                        fill="white"
                        fillOpacity="0.6"
                    />
                </>
            )}
        </svg>
    );
}
