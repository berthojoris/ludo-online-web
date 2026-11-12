import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
};

export function DiceIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
            <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function UsersIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M16 19v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 17.4V19" />
            <circle cx="9.5" cy="7.5" r="3.2" />
            <path d="M21 19v-1.5a3.4 3.4 0 0 0-2.6-3.3" />
            <path d="M15.8 4.3a3.2 3.2 0 0 1 0 6.1" />
        </svg>
    );
}

export function LinkIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M10.5 13.5a3.6 3.6 0 0 0 5.1 0l2.5-2.5a3.6 3.6 0 1 0-5.1-5.1l-1.2 1.2" />
            <path d="M13.5 10.5a3.6 3.6 0 0 0-5.1 0l-2.5 2.5a3.6 3.6 0 1 0 5.1 5.1l1.2-1.2" />
        </svg>
    );
}

export function ShieldIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M12 3.2 19 6v5.1c0 4.2-2.8 7.6-7 9.7-4.2-2.1-7-5.5-7-9.7V6l7-2.8Z" />
            <path d="m9 12 2.1 2.1L15.4 10" />
        </svg>
    );
}

export function ArrowRightIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M4.5 12h15" />
            <path d="m13.5 6 6 6-6 6" />
        </svg>
    );
}

export function ChevronLeftIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="m14.5 6-6 6 6 6" />
        </svg>
    );
}

export function ChevronDownIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="m6 9.5 6 6 6-6" />
        </svg>
    );
}

export function CopyIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
            <path d="M15.5 8.5v-2a2.5 2.5 0 0 0-2.5-2.5H6a2.5 2.5 0 0 0-2.5 2.5V13A2.5 2.5 0 0 0 6 15.5h2" />
        </svg>
    );
}

export function CheckIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="m4.8 12.6 4.5 4.5L19.2 7" />
        </svg>
    );
}

export function StarIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
            <path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.6Z" />
        </svg>
    );
}

export function TrophyIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M8 4.5h8v4a4 4 0 0 1-8 0v-4Z" />
            <path d="M8 6H5.5v1.5A3.5 3.5 0 0 0 9 11" />
            <path d="M16 6h2.5v1.5A3.5 3.5 0 0 1 15 11" />
            <path d="M12 12.5V16" />
            <path d="M8.5 19.5h7" />
            <path d="M9.5 16h5l.7 3.5h-6.4l.7-3.5Z" />
        </svg>
    );
}

export function SparklesIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="m12 3 1.5 4.3L18 9l-4.5 1.7L12 15l-1.5-4.3L6 9l4.5-1.7L12 3Z" />
            <path d="M18.5 14.5 19.4 17l2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.5Z" />
            <path d="M5 15.5 5.7 17.4 7.5 18l-1.8.6L5 20.5l-.7-1.9L2.5 18l1.8-.6L5 15.5Z" />
        </svg>
    );
}

export function GlobeIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.8 9.5h16.4M3.8 14.5h16.4" />
            <path d="M12 3.5c2.3 2.3 3.4 5.2 3.4 8.5s-1.1 6.2-3.4 8.5c-2.3-2.3-3.4-5.2-3.4-8.5S9.7 5.8 12 3.5Z" />
        </svg>
    );
}

export function LockIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
            <circle cx="12" cy="15.2" r="1.1" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function RefreshIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M20 11.5a8 8 0 0 0-13.8-5L3.5 9" />
            <path d="M3.5 4.5V9H8" />
            <path d="M4 12.5a8 8 0 0 0 13.8 5l2.7-2.5" />
            <path d="M20.5 19.5V15H16" />
        </svg>
    );
}

export function HashIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M9 4 7.5 20M16.5 4 15 20M4.5 9h15M4 15h15" />
        </svg>
    );
}

export function InfoIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 11v5" />
            <circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function PlayIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
            <path d="M8.4 5.4a1.3 1.3 0 0 1 2-1.1l9 6.6a1.3 1.3 0 0 1 0 2.2l-9 6.6a1.3 1.3 0 0 1-2-1.1V5.4Z" />
        </svg>
    );
}

export function LogoutIcon(props: IconProps) {
    return (
        <svg {...base} {...props}>
            <path d="M15 4.5h3A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3" />
            <path d="M10 8.5 6.5 12l3.5 3.5" />
            <path d="M6.5 12H16" />
        </svg>
    );
}
