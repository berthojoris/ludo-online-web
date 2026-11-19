import { useModalViewport } from '@/lib/useModalViewport';
import {
    Dialog,
    DialogPanel,
    Transition,
    TransitionChild,
} from '@headlessui/react';
import { Fragment, MutableRefObject, PropsWithChildren, RefObject } from 'react';

export default function Modal({
    children,
    show = false,
    maxWidth = '2xl',
    closeable = true,
    onClose = () => {},
    ariaLabelledBy,
    ariaDescribedBy,
    initialFocus,
    cardClassName = '',
}: PropsWithChildren<{
    show: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    closeable?: boolean;
    onClose: CallableFunction;
    ariaLabelledBy?: string;
    ariaDescribedBy?: string;
    initialFocus?:
        | MutableRefObject<HTMLElement | null>
        | RefObject<HTMLElement | null>;
    cardClassName?: string;
}>) {
    const overlayStyle = useModalViewport(show);

    const close = () => {
        if (closeable) {
            onClose();
        }
    };

    const maxWidthClass = {
        sm: 'max-w-[min(100%,24rem)]',
        md: 'max-w-[min(100%,25rem)]',
        lg: 'max-w-[min(100%,32rem)]',
        xl: 'max-w-[min(100%,36rem)]',
        '2xl': 'max-w-[min(100%,42rem)]',
    }[maxWidth];

    return (
        <Transition show={show} as={Fragment}>
            <Dialog
                as="div"
                id="modal"
                className="relative z-50"
                initialFocus={initialFocus}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                onClose={close}
            >
                <TransitionChild
                    as={Fragment}
                    enter="duration-200 ease-out"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="duration-150 ease-in"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div
                        aria-hidden="true"
                        className="bg-ink/20 fixed inset-0"
                    />
                </TransitionChild>

                <div className="modal-overlay" style={overlayStyle}>
                    <TransitionChild
                        as={Fragment}
                        enter="duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                        enterFrom="translate-y-2.5 scale-[0.97] opacity-0"
                        enterTo="translate-y-0 scale-100 opacity-100"
                        leave="duration-150 ease-in"
                        leaveFrom="translate-y-0 scale-100 opacity-100"
                        leaveTo="translate-y-2.5 scale-[0.97] opacity-0"
                    >
                        <DialogPanel
                            className={`modal-panel modal-bezel outline-none ${maxWidthClass}`}
                        >
                            <div
                                className={`modal-bezel-card ${cardClassName}`.trim()}
                            >
                                {children}
                            </div>
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </Transition>
    );
}
