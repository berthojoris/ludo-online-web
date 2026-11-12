import Logo from '@/Components/Game/Logo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="bg-canvas relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
            >
                <div className="bg-brand/10 absolute top-10 -left-28 h-72 w-72 rounded-full blur-3xl" />
                <div className="bg-ludo-yellow/10 absolute -right-20 bottom-0 h-80 w-80 rounded-full blur-3xl" />
                <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_72%)] opacity-30" />
            </div>

            <Link
                href="/"
                aria-label="Beranda Ludo Arena"
                className="relative rounded-xl"
            >
                <Logo className="h-11 w-11" withWordmark />
            </Link>

            <div className="border-line/80 shadow-card relative mt-7 w-full overflow-hidden rounded-[24px] border bg-white px-6 py-6 sm:max-w-md">
                {children}
            </div>

            <p className="text-ink-muted relative mt-6 text-xs">
                Lempar. Berlomba. Kuasai papan.
            </p>
        </div>
    );
}
