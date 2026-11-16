import { CSSProperties } from 'react';

export type PionMotion = 'idle' | 'hop' | 'knocked';

type PionFigureProps = {
    pionImage: string;
    legal?: boolean;
    busy?: boolean;
    motion?: PionMotion;
    hopPhase?: 0 | 1;
    stacked?: boolean;
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
    hopPhase = 0,
    stacked = false,
    style,
}: PionFigureProps) {
    return (
        <span
            aria-hidden="true"
            className="pion"
            data-legal={legal || undefined}
            data-motion={motion}
            data-hop={motion === 'hop' ? hopPhase : undefined}
            data-stacked={stacked || undefined}
            style={style}
        >
            {legal && <span className="pion-aura" />}
            <span className="pion-shadow" />
            <span className="pion-base" />
            {busy && <span className="pion-busy" />}
            <span className="pion-figure">
                <span className="pion-motion">
                    {legal && <span className="pion-cue" />}
                    <img
                        src={pionImage}
                        alt=""
                        width={192}
                        height={320}
                        draggable={false}
                        decoding="async"
                        className="pion-art"
                    />
                </span>
            </span>
        </span>
    );
}
