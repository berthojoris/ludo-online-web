import { useRetryingImage } from '@/lib/useRetryingImage';
import { CSSProperties } from 'react';

type LudoPinProps = {
    className?: string;
    style?: CSSProperties;
    pionImage?: string | null;
};

export default function LudoPin({
    className = '',
    style,
    pionImage,
}: LudoPinProps) {
    const art = useRetryingImage(pionImage ?? '');

    if (pionImage && art.loaded && !art.failed) {
        return (
            <img
                ref={art.ref}
                src={art.src}
                onError={art.onError}
                onLoad={art.onLoad}
                alt=""
                aria-hidden="true"
                width={192}
                height={320}
                draggable={false}
                decoding="sync"
                className={`object-contain object-bottom drop-shadow-[0_1px_1.5px_rgba(20,32,52,0.3)] select-none ${className}`}
                style={style}
            />
        );
    }

    return (
        <>
            {/* Keeps retrying the art in the background while the pin shows. */}
            {pionImage && (
                <img
                    ref={art.ref}
                    src={art.src}
                    alt=""
                    aria-hidden="true"
                    onError={art.onError}
                    onLoad={art.onLoad}
                    className="hidden"
                />
            )}
            <svg
                aria-hidden="true"
                className={className}
                style={style}
                viewBox="0 0 32 40"
                fill="none"
            >
                <path
                    d="M16 38C13.5 34.8 3 24.6 3 15.5C3 8.1 8.8 2 16 2S29 8.1 29 15.5C29 24.6 18.5 34.8 16 38Z"
                    fill="white"
                    stroke="var(--token-dark, #405066)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                />
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
            </svg>
        </>
    );
}
