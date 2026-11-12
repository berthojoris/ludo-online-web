import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useRef, useState } from 'react';

export default function DeleteUserForm({
    className = '',
}: {
    className?: string;
}) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser: FormEventHandler = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);

        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-6 ${className}`}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">
                    Hapus akun
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    Setelah akun dihapus, semua sumber daya dan datanya akan
                    dihapus permanen. Sebelum menghapus akun, unduh dulu data
                    atau informasi yang ingin kamu simpan.
                </p>
            </header>

            <DangerButton onClick={confirmUserDeletion}>
                Hapus akun
            </DangerButton>

            <Modal show={confirmingUserDeletion} onClose={closeModal}>
                <form onSubmit={deleteUser} className="p-6">
                    <h2 className="text-lg font-medium text-gray-900">
                        Yakin ingin menghapus akun kamu?
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                        Setelah akun dihapus, semua sumber daya dan datanya akan
                        dihapus permanen. Masukkan kata sandi untuk memastikan
                        kamu benar-benar ingin menghapus akun ini secara
                        permanen.
                    </p>

                    <div className="mt-6">
                        <InputLabel
                            htmlFor="password"
                            value="Kata sandi"
                            className="sr-only"
                        />

                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            className="mt-1 block w-3/4"
                            isFocused
                            placeholder="Kata sandi"
                        />

                        <InputError
                            message={errors.password}
                            className="mt-2"
                        />
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeModal}>
                            Batal
                        </SecondaryButton>

                        <DangerButton className="ms-3" disabled={processing}>
                            Hapus akun
                        </DangerButton>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
