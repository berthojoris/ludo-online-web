import { CloseIcon, PencilIcon } from '@/Components/Game/Icons';
import { hasCoarsePointer, useModalViewport } from '@/lib/useModalViewport';
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { FormEvent, useRef } from 'react';

export default function RequiredPlayerNameModal({
    open,
    roomCode,
    onClose,
}: {
    open: boolean;
    roomCode: string;
    onClose?: () => void;
}) {
    const overlayStyle = useModalViewport(open);
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const form = useForm({ name: '' });

    const handleClose = () => {
        if (!form.processing) {
            onClose?.();
        }
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.data.name.trim() || form.processing) return;
        form.transform((data) => ({ name: data.name.trim() }));
        form.post(route('rooms.name', { code: roomCode }), { preserveScroll: true });
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            initialFocus={hasCoarsePointer() ? panelRef : inputRef}
            className="relative z-50"
        >
            <div className="modal-overlay bg-ink/20" style={overlayStyle}>
                <DialogPanel
                    ref={panelRef}
                    tabIndex={-1}
                    className="modal-panel modal-bezel animate-modal-enter max-w-[min(100%,25rem)] outline-none"
                >
                    <div className="modal-bezel-card">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="bg-brand/10 text-brand grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                                    <PencilIcon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                    <DialogTitle className="text-ink text-base font-semibold">Masukkan nama pemain</DialogTitle>
                                    <DialogDescription className="text-ink-muted mt-1 text-xs leading-relaxed">
                                        Isi nama yang akan dilihat pemain lain sebelum permainan dimulai.
                                    </DialogDescription>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={form.processing}
                                onClick={handleClose}
                                aria-label="Tutup dialog"
                                className="btn btn-quiet btn-sm btn-icon shrink-0"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={submit}>
                            <label htmlFor="required-player-name" className="text-ink mt-4 block text-xs font-semibold">Nama pemain</label>
                            <input
                                ref={inputRef}
                                id="required-player-name"
                                type="text"
                                value={form.data.name}
                                onChange={(event) => { form.setData('name', event.target.value); form.clearErrors('name'); }}
                                maxLength={24}
                                autoComplete="off"
                                placeholder="Masukkan nama"
                                disabled={form.processing}
                                aria-invalid={form.errors.name ? true : undefined}
                                aria-describedby={form.errors.name ? 'required-player-name-error' : undefined}
                                className={`text-ink focus-visible:ring-brand/60 mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-base transition outline-none focus-visible:ring-2 disabled:opacity-60 ${
                                    form.errors.name ? 'border-danger' : 'border-line'
                                }`}
                            />
                            {form.errors.name && <p id="required-player-name-error" role="alert" className="text-danger mt-1.5 text-xs leading-relaxed">{form.errors.name}</p>}
                            <div className="mt-5 flex flex-wrap items-center gap-2">
                                <button type="submit" disabled={form.processing || !form.data.name.trim()} aria-busy={form.processing} className="btn btn-primary min-w-[6.5rem] flex-1">
                                    {form.processing && <span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                    {form.processing ? 'Menyimpan…' : 'Simpan nama'}
                                </button>
                            </div>
                        </form>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
