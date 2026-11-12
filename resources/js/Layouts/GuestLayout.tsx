import Logo from '@/Components/Game/Logo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-10">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
            >
                <div className="absolute -left-28 top-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
                <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-ludo-yellow/10 blur-3xl" />
                <div className="dot-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]" />
            </div>

            <Link
                href="/"
                aria-label="Ludo Arena home"
                className="relative rounded-xl"
            >
                <Logo className="h-11 w-11" withWordmark />
            </Link>

            <div className="relative mt-7 w-full overflow-hidden rounded-[24px] border border-line/80 bg-white px-6 py-6 shadow-card sm:max-w-md">
                {children}
            </div>

            <p className="relative mt-6 text-xs text-ink-muted">
                Roll. Race. Rule the board.
            </p>
        </div>
    );
}
