/**
 * Keyframe builders for the board's Web Animations. Positions are board
 * percentages (0-100) and are rendered as `cqw`, because the board root is an
 * inline-size container and always square.
 */

export type BoardPlacement = {
    /** Horizontal center in board percent. */
    x: number;
    /** Vertical center in board percent. */
    y: number;
    /** Fan offset in percent of the token's own size. */
    dx: number;
    dy: number;
};

export const WALK_STEP_MS = 140;
export const LEAP_MS = 420;
export const HIT_STOP_MS = 110;

const SEGMENT_EASING = 'cubic-bezier(0.37, 0, 0.63, 1)';

export function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

/**
 * The single transform used for a token wrapper, both when React renders it
 * and inside animations, so the two always interpolate function by function.
 */
export function placementTransform({ x, y, dx, dy }: BoardPlacement): string {
    return `translate(${x}cqw, ${y}cqw) translate(-50%, -50%) translate(${dx}%, ${dy}%)`;
}

/** One keyframe per cell, eased per segment so every hop settles on its cell. */
export function walkKeyframes(
    from: BoardPlacement,
    path: BoardPlacement[],
    reducedMotion: boolean,
): Keyframe[] {
    const points = [from, ...path];
    const segments = Math.max(1, points.length - 1);

    return points.map((point, index) => ({
        offset: index / segments,
        transform: placementTransform(point),
        easing: reducedMotion ? 'steps(1, end)' : SEGMENT_EASING,
    }));
}

/** Squash-and-stretch hop for the figure; it repeats once per walked cell. */
export const HOP_KEYFRAMES: Keyframe[] = [
    { offset: 0, transform: 'translateY(0) scale(1)' },
    { offset: 0.22, transform: 'translateY(-15%) scale(0.97, 1.04)' },
    { offset: 0.5, transform: 'translateY(-22%) scale(0.97, 1.04)' },
    { offset: 0.78, transform: 'translateY(-14%) scale(1)' },
    { offset: 0.92, transform: 'translateY(0) scale(1.05, 0.94)' },
    { offset: 1, transform: 'translateY(0) scale(1)' },
];

/** Big jump used when a pion leaves its base for the start cell. */
export const LEAP_KEYFRAMES: Keyframe[] = [
    { offset: 0, transform: 'translateY(0) scale(1)' },
    { offset: 0.12, transform: 'translateY(4%) scale(1.08, 0.9)' },
    { offset: 0.45, transform: 'translateY(-70%) scale(0.94, 1.08)' },
    { offset: 0.86, transform: 'translateY(0) scale(1.1, 0.88)' },
    { offset: 1, transform: 'translateY(0) scale(1)' },
];

export const SHADOW_HOP_KEYFRAMES: Keyframe[] = [
    { offset: 0, scale: '1', opacity: 1 },
    { offset: 0.5, scale: '0.62', opacity: 0.5 },
    { offset: 1, scale: '1', opacity: 1 },
];

/** The victim flinches on impact before it is thrown. */
export const HIT_KEYFRAMES: Keyframe[] = [
    { offset: 0, transform: 'translateX(0) scale(1)' },
    { offset: 0.25, transform: 'translateX(-8%) scale(1.12, 0.84)' },
    { offset: 0.55, transform: 'translateX(7%) scale(0.92, 1.08)' },
    { offset: 1, transform: 'translateX(0) scale(1)' },
];

/** Sampled parabola from the capture cell back to the base pad. */
export function launchKeyframes(
    from: BoardPlacement,
    to: BoardPlacement,
): Keyframe[] {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const height = Math.max(10, Math.min(30, distance * 0.45));
    const samples = 12;

    return Array.from({ length: samples + 1 }, (_, index) => {
        const t = index / samples;

        return {
            offset: t,
            transform: placementTransform({
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t - height * 4 * t * (1 - t),
                dx: from.dx + (to.dx - from.dx) * t,
                dy: from.dy + (to.dy - from.dy) * t,
            }),
        };
    });
}

export function launchDuration(from: BoardPlacement, to: BoardPlacement) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);

    return Math.round(Math.max(520, Math.min(820, 460 + distance * 5)));
}

export const SPIN_KEYFRAMES: Keyframe[] = [
    {
        offset: 0,
        transformOrigin: '50% 55%',
        transform: 'rotate(0deg) scale(1)',
    },
    {
        offset: 0.5,
        transformOrigin: '50% 55%',
        transform: 'rotate(380deg) scale(0.86)',
    },
    {
        offset: 0.9,
        transformOrigin: '50% 55%',
        transform: 'rotate(720deg) scale(1.08, 0.9)',
    },
    {
        offset: 1,
        transformOrigin: '50% 55%',
        transform: 'rotate(720deg) scale(1)',
    },
];

export const FLIGHT_SHADOW_KEYFRAMES: Keyframe[] = [
    { offset: 0, opacity: 1 },
    { offset: 0.2, opacity: 0 },
    { offset: 0.85, opacity: 0 },
    { offset: 1, opacity: 1 },
];

/** Cubic ease-in-out curve shared by drag keyframes and skid dust timing. */
export function dragProgress(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Sampled ground-level drag path from the capture cell back to the base pad. */
export function dragKeyframes(
    from: BoardPlacement,
    to: BoardPlacement,
): Keyframe[] {
    const dxTotal = to.x - from.x;
    const dyTotal = to.y - from.y;
    const distance = Math.hypot(dxTotal, dyTotal) || 1;
    const nx = -dyTotal / distance;
    const ny = dxTotal / distance;
    const samples = 16;

    return Array.from({ length: samples + 1 }, (_, index) => {
        const t = index / samples;
        const progress = dragProgress(t);
        const jitter =
            index === 0 || index === samples
                ? 0
                : Math.sin(t * Math.PI * 5) * (1 - t) * 0.85;

        return {
            offset: t,
            transform: placementTransform({
                x: from.x + dxTotal * progress + nx * jitter,
                y: from.y + dyTotal * progress + ny * jitter,
                dx: from.dx + (to.dx - from.dx) * progress,
                dy: from.dy + (to.dy - from.dy) * progress,
            }),
        };
    });
}

export function dragDuration(from: BoardPlacement, to: BoardPlacement) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);

    return Math.round(Math.max(580, Math.min(920, 500 + distance * 5.8)));
}

/** Victim leans back and scrapes along the board while being dragged to base. */
export function dragFigureKeyframes(
    from: BoardPlacement,
    to: BoardPlacement,
): Keyframe[] {
    const lean = to.x >= from.x ? -26 : 26;

    return [
        {
            offset: 0,
            transformOrigin: '50% 85%',
            transform: 'rotate(0deg) scale(1)',
        },
        {
            offset: 0.14,
            transformOrigin: '50% 85%',
            transform: `rotate(${lean * 1.15}deg) scale(1.06, 0.9)`,
        },
        {
            offset: 0.45,
            transformOrigin: '50% 85%',
            transform: `rotate(${lean * 0.9}deg) scale(1.04, 0.92)`,
        },
        {
            offset: 0.78,
            transformOrigin: '50% 85%',
            transform: `rotate(${lean * 1.05}deg) scale(1.05, 0.91)`,
        },
        {
            offset: 0.92,
            transformOrigin: '50% 85%',
            transform: `rotate(${-lean * 0.22}deg) scale(0.96, 1.04)`,
        },
        {
            offset: 1,
            transformOrigin: '50% 85%',
            transform: 'rotate(0deg) scale(1)',
        },
    ];
}

export const DRAG_SHADOW_KEYFRAMES: Keyframe[] = [
    { offset: 0, opacity: 1, transform: 'scale(1)' },
    { offset: 0.18, opacity: 0.82, transform: 'scale(1.18, 0.92)' },
    { offset: 0.78, opacity: 0.78, transform: 'scale(1.15, 0.92)' },
    { offset: 1, opacity: 1, transform: 'scale(1)' },
];

export const SHAKE_KEYFRAMES: Keyframe[] = [
    { transform: 'translate(0, 0)' },
    { transform: 'translate(-1.1%, 0.5%) rotate(-0.5deg)' },
    { transform: 'translate(1%, -0.6%) rotate(0.45deg)' },
    { transform: 'translate(-0.7%, 0.3%) rotate(-0.25deg)' },
    { transform: 'translate(0.4%, -0.2%)' },
    { transform: 'translate(0, 0)' },
];

/** Resolves when the animation ends or is cancelled; never rejects. */
export function settled(animation: Animation): Promise<void> {
    return animation.finished.then(
        () => undefined,
        () => undefined,
    );
}

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
