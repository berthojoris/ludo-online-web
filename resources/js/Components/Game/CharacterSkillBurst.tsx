import {
    Cell,
    CharacterId,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
} from '@/lib/ludo';
import { CSSProperties, useEffect, useState } from 'react';

export type SkillBurst = {
    id: string;
    color: PlayerColor;
    character?: CharacterId | string | null;
    point: Cell;
};

type CharacterSkillBurstProps = {
    burst: SkillBurst;
    leftPercent: number;
    topPercent: number;
    onEnd?: (id: string) => void;
};

export const SKILL_BURST_DURATION_MS = 1400;
const REDUCED_MOTION_HOLD_MS = 1000;

/**
 * Capture skill: the attacker's character rises out of the capture cell,
 * swells into a giant over the board and dissolves. Purely cosmetic; the
 * capture itself is already committed when this plays.
 */
export default function CharacterSkillBurst({
    burst,
    leftPercent,
    topPercent,
    onEnd,
}: CharacterSkillBurstProps) {
    const [reducedMotion] = useState(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const character = getCharacterConfig(burst.character, burst.color);
    const glow = PLAYER_CONFIG[character.accentColor].palette;

    useEffect(() => {
        if (!onEnd) {
            return;
        }

        const timeout = window.setTimeout(
            () => onEnd(burst.id),
            reducedMotion ? REDUCED_MOTION_HOLD_MS : SKILL_BURST_DURATION_MS,
        );

        return () => window.clearTimeout(timeout);
    }, [burst.id, onEnd, reducedMotion]);

    const style = {
        '--burst-x': `${leftPercent}%`,
        '--burst-y': `${topPercent}%`,
        '--burst-dx': `${leftPercent - 50}cqw`,
        '--burst-dy': `${topPercent - 50}cqw`,
        '--burst-glow': glow.base,
        '--burst-glow-light': glow.light,
        '--burst-glow-dark': glow.dark,
        '--burst-duration': `${SKILL_BURST_DURATION_MS}ms`,
    } as CSSProperties;

    return (
        <div
            className="skill-burst"
            data-reduced={reducedMotion || undefined}
            style={style}
        >
            <span className="skill-burst-flash" />
            <span className="skill-burst-ring" />
            <div className="skill-burst-giant">
                <span className="skill-burst-aura" />
                <img
                    src={character.image}
                    alt=""
                    width={1254}
                    height={1254}
                    draggable={false}
                    decoding="async"
                    className="skill-burst-art"
                />
            </div>
            <span className="skill-burst-name">
                <span className="skill-burst-name-char">{character.name}</span>
                <span className="skill-burst-name-skill">
                    {character.skill}!
                </span>
            </span>
        </div>
    );
}
