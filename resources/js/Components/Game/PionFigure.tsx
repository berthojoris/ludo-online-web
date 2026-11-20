import { usePageResumeCount } from '@/lib/usePageResumeCount';
import { useRetryingImage } from '@/lib/useRetryingImage';
import { CSSProperties, useState } from 'react';
import LudoPin from './LudoPin';

export type PionMotion = 'idle' | 'hop' | 'knocked';

type PionFigureProps = {
    pionImage: string;
    legal?: boolean;
    busy?: boolean;
    motion?: PionMotion;
    /** A stacked duplicate drawn by another pion; revealing it repaints the figure. */
    hidden?: boolean;
    stacked?: boolean;
    stackCount?: number;
    style?: CSSProperties;
};

type FigureRestState = {
    motion: PionMotion;
    hidden: boolean;
    resumeCount: number;
    repaintKey: number;
};

/**
 * Returns a key that changes each time the pion comes back to rest: a walk or
 * knock-back settled, a stacked duplicate was revealed, or the page returned
 * from the background.
 *
 * The figure is the only part of a pion that engines move onto its own
 * compositor layers (hop, leap, knock-back and legal-bob animations). On some
 * phones such a layer can come back blank after the animation ends or after
 * the GPU dropped its textures in the background, leaving only the shadow and
 * base ring, which are painted with the board. Keying the figure on this
 * value rebuilds it at those moments, so it is painted from scratch instead
 * of reusing a possibly lost layer. Running animations are never cut off,
 * because the key only changes once the pion is idle and visible.
 */
function useFigureRepaintKey(motion: PionMotion, hidden: boolean): number {
    const resumeCount = usePageResumeCount();
    const [rest, setRest] = useState<FigureRestState>({
        motion,
        hidden,
        resumeCount,
        repaintKey: 0,
    });

    if (
        rest.motion !== motion ||
        rest.hidden !== hidden ||
        rest.resumeCount !== resumeCount
    ) {
        const isResting = motion === 'idle' && !hidden;
        const cameToRest =
            rest.motion !== 'idle' ||
            rest.hidden ||
            rest.resumeCount !== resumeCount;

        setRest({
            motion,
            hidden,
            resumeCount,
            repaintKey:
                isResting && cameToRest ? rest.repaintKey + 1 : rest.repaintKey,
        });
    }

    return rest.repaintKey;
}

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
    hidden = false,
    stacked = false,
    stackCount = 1,
    style,
}: PionFigureProps) {
    const hasCount = stackCount > 1;
    const art = useRetryingImage(pionImage);
    const repaintKey = useFigureRepaintKey(motion, hidden);

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
            <span key={repaintKey} className="pion-figure">
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
                        data-failed={art.failed || undefined}
                        className="pion-art"
                    />
                </span>
            </span>
        </span>
    );
}
