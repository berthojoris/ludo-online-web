import { useModalViewport } from '@/lib/useModalViewport';
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function RequiredPlayerNameModal({ open, roomCode }: { open: boolean; roomCode: string }) {
    const overlayStyle = useModalViewport(open);
    const form = useForm({ name: '' });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.data.name.trim() || form.processing) return;
        form.transform((data) => ({ name: data.name.trim() }));
        form.post(route('rooms.name', { code: roomCode }), { preserveScroll: true });
    };

    return (
        <Dialog open={open} onClose={() => {}} className="relative z-50">
            <div className="modal-overlay bg-ink/40 backdrop-blur-[3px]" style={overlayStyle}>
                <DialogPanel className="modal-panel border-line max-w-sm overflow-y-auto overscroll-contain rounded-[24px] border bg-white p-5">
                    <DialogTitle className="text-ink text-base font-semibold">Masukkan nama pemain</DialogTitle>
                    <DialogDescription className="text-ink-muted mt-1 text-xs leading-relaxed">
                        Isi nama yang akan dilihat pemain lain sebelum permainan dimulai.
                    </DialogDescription>
                    <form onSubmit={submit}>
                        <label htmlFor="required-player-name" className="text-ink mt-4 block text-xs font-semibold">Nama pemain</label>
                        <input
                            id="required-player-name"
                            type="text"
                            value={form.data.name}
                            onChange={(event) => { form.setData('name', event.target.value); form.clearErrors('name'); }}
                            maxLength={24}
                            autoComplete="nickname"
                            placeholder="Masukkan nama"
                            disabled={form.processing}
                            aria-invalid={Boolean(form.errors.name)}
                            aria-describedby={form.errors.name ? 'required-player-name-error' : undefined}
                            className="border-line bg-canvas text-ink focus-visible:ring-brand/60 mt-1.5 h-11 w-full rounded-xl border px-3 text-base outline-none focus-visible:ring-2 disabled:opacity-60"
                        />
                        {form.errors.name && <p id="required-player-name-error" role="alert" className="text-danger mt-1.5 text-xs">{form.errors.name}</p>}
                        <button type="submit" disabled={form.processing || !form.data.name.trim()} aria-busy={form.processing} className="btn btn-primary mt-4 w-full">
                            {form.processing && <span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            {form.processing ? 'Menyimpan…' : 'Simpan nama'}
                        </button>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
