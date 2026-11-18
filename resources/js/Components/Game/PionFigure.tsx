import { useRetryingImage } from '@/lib/useRetryingImage';
import { CSSProperties } from 'react';
import LudoPin from './LudoPin';

export type PionMotion = 'idle' | 'hop' | 'knocked';

type PionFigureProps = {
    pionImage: string;
    legal?: boolean;
    busy?: boolean;
    motion?: PionMotion;
    stacked?: boolean;
    stackCount?: number;
    style?: CSSProperties;
};

/**
 * Character pion standing on its cell: contact shadow, seat-colored base ring
 * and the character art. Seat colors come from the `--token-*` custom
 * properties set by the parent so ownership stays readable even when the
 * character's own palette differs from the seat.
 */
export default function PionFigure({
    pionImage,
    legal = false,
    busy = false,
    motion = 'idle',
    stacked = false,
    stackCount = 1,
    style,
}: PionFigureProps) {
    const hasCount = stackCount > 1;
    const art = useRetryingImage(pionImage);

    return (
        <span
            aria-hidden="true"
            className="pion"
            data-legal={legal || undefined}
            data-motion={motion}
            data-stacked={stacked || undefined}
            data-has-count={hasCount || undefined}
            style={style}
        >
            {legal && <span className="pion-aura" />}
            <span className="pion-shadow" />
            <span className="pion-base" />
            {busy && <span className="pion-busy" />}
            <span className="pion-figure">
                <span className="pion-motion">
                    {legal && <span className="pion-cue" />}
                    {hasCount && (
                        <span className="pion-count">{stackCount}</span>
                    )}
                    {(!art.loaded || art.failed) && (
                        <LudoPin className="pion-art-fallback" />
                    )}
                    <img
                        ref={art.ref}
                        src={art.src}
                        alt=""
                        width={192}
                        height={320}
                        draggable={false}
                        decoding="sync"
                        onError={art.onError}
                        onLoad={art.onLoad}
                        data-failed={!art.loaded || art.failed || undefined}
                        className="pion-art"
                    />
                </span>
            </span>
        </span>
    );
}
