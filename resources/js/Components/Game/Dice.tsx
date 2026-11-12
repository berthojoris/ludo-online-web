import { useEffect, useRef, useState } from 'react';

type DiceProps = {
    value: number;
    rolling?: boolean;
    className?: string;
};

type Face = {
    value: number;
    transform: string;
};

const PIPS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

/**
 * Rotation applied to the cube so a given face points at the viewer.
 * The faces themselves are built in `FACES` below.
 */
const FACE_ROTATION: Record<number, { x: number; y: number }> = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: -90 },
    3: { x: 0, y: -180 },
    4: { x: 0, y: 90 },
    5: { x: -90, y: 0 },
    6: { x: 90, y: 0 },
};

const FACES: Face[] = [
    { value: 1, transform: 'rotateY(0deg)' },
    { value: 2, transform: 'rotateY(90deg)' },
    { value: 3, transform: 'rotateY(180deg)' },
    { value: 4, transform: 'rotateY(-90deg)' },
    { value: 5, transform: 'rotateX(90deg)' },
    { value: 6, transform: 'rotateX(-90deg)' },
];

const normalise = (degrees: number) => ((degrees % 360) + 360) % 360;

function DiceFace({ value }: { value: number }) {
    const activePips = PIPS[value] ?? PIPS[1];

    return (
        <div className="absolute inset-[13%] grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} className="flex items-center justify-center">
                    {activePips.includes(index) && (
                        <span className="bg-ink block h-[58%] w-[58%] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)]" />
                    )}
                </span>
            ))}
        </div>
    );
}

export default function Dice({
    value,
    rolling = false,
    className = 'h-14 w-14',
}: DiceProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const cubeRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<Animation | null>(null);
    const rotationRef = useRef({ x: 0, y: 0 });
    const [halfSize, setHalfSize] = useState(28);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const element = rootRef.current;

        if (!element) {
            return;
        }

        const measure = () => {
            setHalfSize(Math.max(1, element.getBoundingClientRect().width / 2));
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReducedMotion(query.matches);

        update();
        query.addEventListener('change', update);

        return () => query.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        const cube = cubeRef.current;

        if (!cube) {
            return;
        }

        const target = FACE_ROTATION[value] ?? FACE_ROTATION[1];

        const settle = () => {
            cube.style.transform = `rotateX(${target.x}deg) rotateY(${target.y}deg)`;
            rotationRef.current = { x: target.x, y: target.y };
        };

        animationRef.current?.cancel();
        animationRef.current = null;

        if (!rolling || reducedMotion) {
            settle();

            return;
        }

        const from = rotationRef.current;
        const endX = from.x + 720 + normalise(target.x - from.x);
        const endY = from.y + 1080 + normalise(target.y - from.y);

        const animation = cube.animate(
            [
                {
                    transform: `rotateX(${from.x}deg) rotateY(${from.y}deg) translateY(0) scale(1)`,
                    offset: 0,
                },
                {
                    transform: `rotateX(${
                        from.x + (endX - from.x) * 0.3
                    }deg) rotateY(${
                        from.y + (endY - from.y) * 0.42
                    }deg) translateY(-16%) scale(1.07)`,
                    offset: 0.22,
                },
                {
                    transform: `rotateX(${
                        from.x + (endX - from.x) * 0.58
                    }deg) rotateY(${
                        from.y + (endY - from.y) * 0.66
                    }deg) translateY(-6%) scale(1.02)`,
                    offset: 0.52,
                },
                {
                    transform: `rotateX(${
                        from.x + (endX - from.x) * 0.86
                    }deg) rotateY(${
                        from.y + (endY - from.y) * 0.9
                    }deg) translateY(-11%) scale(1.04)`,
                    offset: 0.8,
                },
                {
                    transform: `rotateX(${endX}deg) rotateY(${endY}deg) translateY(0) scale(1)`,
                    offset: 1,
                },
            ],
            {
                duration: 1000,
                easing: 'cubic-bezier(0.22, 0.75, 0.3, 1)',
                fill: 'forwards',
            },
        );

        animationRef.current = animation;
        rotationRef.current = { x: endX, y: endY };

        return () => animation.cancel();
    }, [rolling, value, reducedMotion]);

    return (
        <div
            ref={rootRef}
            role="img"
            aria-label={`Dadu menunjukkan ${value}`}
            className={`relative ${className}`}
            style={{ perspective: '620px' }}
        >
            <div
                ref={cubeRef}
                className="absolute inset-0"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: `rotateX(${FACE_ROTATION[value]?.x ?? 0}deg) rotateY(${FACE_ROTATION[value]?.y ?? 0}deg)`,
                    willChange: 'transform',
                }}
            >
                {FACES.map((face) => (
                    <div
                        key={face.value}
                        className="dice-face absolute inset-0 rounded-[22%]"
                        style={{
                            transform: `${face.transform} translateZ(${halfSize}px)`,
                            backfaceVisibility: 'hidden',
                        }}
                    >
                        <DiceFace value={face.value} />
                    </div>
                ))}
            </div>
        </div>
    );
}
