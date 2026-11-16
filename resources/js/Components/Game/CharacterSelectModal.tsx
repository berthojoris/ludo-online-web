import { CheckIcon, CloseIcon } from '@/Components/Game/Icons';
import {
    ARENA_BACKGROUND_IMAGE,
    CHARACTER_LIST,
    CharacterId,
    DEFAULT_CHARACTER_BY_COLOR,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
} from '@/lib/ludo';
import { useModalViewport } from '@/lib/useModalViewport';
import { useEffect, useState } from 'react';

type CharacterSelectModalProps = {
    open: boolean;
    seatColor: PlayerColor | null;
    initialCharacter?: CharacterId | string | null;
    processing?: boolean;
    takenCharacters?: Partial<Record<CharacterId, string>>;
    onClose: () => void;
    onConfirm: (character: CharacterId, seatColor: PlayerColor | null) => void;
};

export default function CharacterSelectModal({
    open,
    seatColor,
    initialCharacter,
    processing = false,
    takenCharacters = {},
    onClose,
    onConfirm,
}: CharacterSelectModalProps) {
    const preferredCharacter =
        initialCharacter &&
        CHARACTER_LIST.some((item) => item.id === initialCharacter)
            ? (initialCharacter as CharacterId)
            : seatColor
              ? DEFAULT_CHARACTER_BY_COLOR[seatColor]
              : 'ignivar';
    const resolvedDefault: CharacterId = takenCharacters[preferredCharacter]
        ? (CHARACTER_LIST.find((item) => !takenCharacters[item.id])?.id ??
          preferredCharacter)
        : preferredCharacter;

    const [selectedId, setSelectedId] = useState<CharacterId>(resolvedDefault);
    const overlayStyle = useModalViewport(open);

    useEffect(() => {
        if (open) {
            setSelectedId(resolvedDefault);
        }
    }, [open, resolvedDefault]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !processing) {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, processing, onClose]);

    if (!open) {
        return null;
    }

    const selectedChar = getCharacterConfig(selectedId, seatColor ?? 'red');
    const charPalette = PLAYER_CONFIG[selectedChar.accentColor].palette;
    const seatConfig = seatColor ? PLAYER_CONFIG[seatColor] : null;
    const selectedTakenBy = takenCharacters[selectedId];

    return (
        <div
            className="modal-overlay bg-ink/55 backdrop-blur-[4px]"
            style={overlayStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-select-title"
            aria-describedby="character-select-subtitle"
            onClick={(event) => {
                if (event.target === event.currentTarget && !processing) {
                    onClose();
                }
            }}
        >
            <div className="modal-panel animate-modal-enter flex max-w-2xl flex-col overflow-hidden rounded-[26px] border-2 border-white/80 bg-gradient-to-b from-[#f4f8ff] to-white shadow-[0_28px_70px_-18px_rgba(18,30,52,0.48)]">
                {/* Header */}
                <div className="border-line/70 flex shrink-0 items-center justify-between gap-3 border-b bg-white/90 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="bg-brand/12 text-brand grid h-10 w-10 shrink-0 place-items-center rounded-2xl shadow-inner sm:h-11 sm:w-11">
                            <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                                className="h-5 w-5 sm:h-6 sm:w-6"
                            >
                                <path d="M6.8 6.5h10.4a4.6 4.6 0 0 1 4.5 5.5l-.8 4.2a3.2 3.2 0 0 1-5.4 1.7l-1.6-1.6a1.5 1.5 0 0 0-1.1-.4h-1.6a1.5 1.5 0 0 0-1.1.4l-1.6 1.6a3.2 3.2 0 0 1-5.4-1.7l-.8-4.2a4.6 4.6 0 0 1 4.5-5.5Zm1.7 2.5a.8.8 0 0 0-.8.8v1.2H6.5a.8.8 0 0 0 0 1.6h1.2v1.2a.8.8 0 0 0 1.6 0v-1.2h1.2a.8.8 0 0 0 0-1.6H9.3V9.8a.8.8 0 0 0-.8-.8Zm7.2.7a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm2.2 2.1a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z" />
                            </svg>
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2
                                    id="character-select-title"
                                    className="text-ink min-w-0 truncate text-base font-extrabold tracking-tight sm:text-lg"
                                >
                                    Pilih Karakter Kamu
                                </h2>
                                {seatConfig && (
                                    <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                        style={{
                                            background: seatConfig.palette.soft,
                                            color: seatConfig.palette.text,
                                            boxShadow: `inset 0 0 0 1px ${seatConfig.palette.base}40`,
                                        }}
                                    >
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{
                                                background:
                                                    seatConfig.palette.base,
                                            }}
                                        />
                                        Kursi {seatConfig.label}
                                    </span>
                                )}
                            </div>
                            <p
                                id="character-select-subtitle"
                                className="text-ink-muted truncate text-xs"
                            >
                                Pilih satu karakter untuk menemanimu di
                                permainan!
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={processing}
                        onClick={onClose}
                        aria-label="Tutup pilih karakter"
                        className="btn btn-quiet btn-sm btn-icon shrink-0"
                    >
                        <CloseIcon className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-5">
                    {/* 7 Character Thumbnails Row */}
                    <div
                        className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-2.5"
                        role="radiogroup"
                        aria-label="Daftar 7 karakter"
                    >
                        {CHARACTER_LIST.map((char) => {
                            const palette =
                                PLAYER_CONFIG[char.accentColor].palette;
                            const isSelected = selectedId === char.id;
                            const usedBy = takenCharacters[char.id];
                            const isTaken = Boolean(usedBy);

                            return (
                                <button
                                    key={char.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={
                                        isTaken
                                            ? `${char.name}, sudah dipilih ${usedBy}`
                                            : char.name
                                    }
                                    title={
                                        isTaken
                                            ? `Sudah dipilih ${usedBy}`
                                            : undefined
                                    }
                                    disabled={processing || isTaken}
                                    onClick={() => setSelectedId(char.id)}
                                    className={`group relative flex cursor-pointer flex-col items-center rounded-2xl p-1 transition-[background-color,box-shadow,opacity] duration-150 disabled:cursor-not-allowed ${
                                        isTaken
                                            ? 'opacity-55 grayscale'
                                            : isSelected
                                              ? ''
                                              : 'opacity-85 hover:opacity-100'
                                    }`}
                                    style={{
                                        background: isSelected
                                            ? palette.soft
                                            : '#ffffff',
                                        boxShadow: isSelected
                                            ? `0 0 0 2px ${palette.base}, inset 0 -3px 0 ${palette.base}55`
                                            : 'inset 0 0 0 1px #e4e8ee, inset 0 -2px 0 rgb(32 43 58 / 8%)',
                                    }}
                                >
                                    {isSelected && (
                                        <span
                                            className="absolute -top-1.5 -right-1.5 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-white shadow-sm"
                                            style={{ background: palette.base }}
                                            aria-hidden="true"
                                        >
                                            <CheckIcon className="h-3 w-3" />
                                        </span>
                                    )}

                                    <div
                                        className="relative aspect-[4/5] w-full overflow-hidden rounded-xl"
                                        style={{
                                            background: `radial-gradient(circle at 50% 30%, ${palette.light}88, ${palette.base})`,
                                        }}
                                    >
                                        <img
                                            src={char.image}
                                            alt={char.name}
                                            width={96}
                                            height={120}
                                            className={`h-full w-full object-cover object-center transition-transform duration-200 ${
                                                isTaken
                                                    ? ''
                                                    : 'group-hover:scale-105'
                                            }`}
                                        />
                                        {isTaken && (
                                            <span className="bg-ink/80 absolute inset-x-1 bottom-1 flex flex-col items-center rounded-lg px-1 py-0.5 text-center leading-tight text-white">
                                                <span className="text-[9px] font-extrabold uppercase">
                                                    Dipakai
                                                </span>
                                                <span className="w-full truncate text-[9px] font-semibold">
                                                    {usedBy}
                                                </span>
                                            </span>
                                        )}
                                    </div>

                                    <span
                                        className="mt-1 w-full truncate rounded-md px-1.5 py-0.5 text-center text-[10px] font-extrabold"
                                        style={{
                                            background: palette.soft,
                                            color: palette.text,
                                        }}
                                    >
                                        {char.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Featured Character Detail Card */}
                    <div className="border-line/80 mt-3.5 grid grid-cols-1 gap-3.5 rounded-[22px] border bg-white p-3 shadow-sm sm:mt-4 sm:grid-cols-[minmax(0,230px)_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-4">
                        {/* Left Artwork Preview on Scenic Arena Backdrop */}
                        <div
                            className="relative mx-auto aspect-[16/11] w-full max-w-[260px] overflow-hidden rounded-2xl border sm:aspect-[4/3] sm:max-w-none"
                            style={{
                                borderColor: `${charPalette.base}40`,
                                background: `radial-gradient(circle at 50% 35%, ${charPalette.light}55, ${charPalette.soft})`,
                            }}
                        >
                            <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-cover bg-center opacity-45"
                                style={{
                                    backgroundImage: `url('${ARENA_BACKGROUND_IMAGE}')`,
                                }}
                            />
                            <div
                                aria-hidden="true"
                                className="absolute inset-0"
                                style={{
                                    background: `linear-gradient(180deg, transparent 20%, ${charPalette.base}33 100%)`,
                                }}
                            />
                            <img
                                src={selectedChar.image}
                                alt={selectedChar.name}
                                width={240}
                                height={190}
                                className="relative z-10 h-full w-full object-contain p-1.5 drop-shadow-[0_10px_16px_rgba(20,32,52,0.28)]"
                            />
                        </div>

                        {/* Right Info & Action */}
                        <div className="flex min-w-0 flex-col justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-ink text-xl font-extrabold tracking-tight sm:text-2xl">
                                        {selectedChar.name}
                                    </h3>
                                    <span
                                        className="rounded-lg border px-2.5 py-0.5 text-xs font-extrabold"
                                        style={{
                                            background: charPalette.soft,
                                            borderColor: `${charPalette.base}40`,
                                            color: charPalette.text,
                                        }}
                                    >
                                        {selectedChar.element}
                                    </span>
                                </div>

                                <p className="text-ink-muted mt-1.5 text-xs leading-relaxed sm:text-sm">
                                    {selectedChar.description}
                                </p>

                                {/* Traits use the character's own palette so each hero reads as one identity. */}
                                <ul
                                    className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2"
                                    aria-label={`Sifat ${selectedChar.name}`}
                                >
                                    {selectedChar.traits.map((trait) => (
                                        <li
                                            key={trait}
                                            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                                            style={{
                                                background: charPalette.soft,
                                                borderColor: `${charPalette.base}40`,
                                                color: charPalette.text,
                                            }}
                                        >
                                            {trait}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {selectedTakenBy && (
                                <p
                                    role="status"
                                    className="text-danger mt-3 text-xs font-bold"
                                >
                                    {selectedChar.name} sudah dipilih{' '}
                                    {selectedTakenBy}. Pilih karakter lain.
                                </p>
                            )}

                            <button
                                type="button"
                                disabled={processing || Boolean(selectedTakenBy)}
                                aria-busy={processing}
                                onClick={() =>
                                    onConfirm(selectedChar.id, seatColor)
                                }
                                className="btn btn-primary mt-4 w-full gap-2 px-5 text-sm font-bold sm:min-h-12"
                            >
                                {processing ? (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                                        />
                                        Menyimpan karakter…
                                    </>
                                ) : (
                                    <span>Gunakan Karakter Ini</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
