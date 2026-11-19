import CharacterSelectModal from '@/Components/Game/CharacterSelectModal';
import ConfirmLeaveModal from '@/Components/Game/ConfirmLeaveModal';
import CreateRoomPasswordModal from '@/Components/Game/CreateRoomPasswordModal';
import RequiredPlayerNameModal from '@/Components/Game/RequiredPlayerNameModal';
import FullscreenToggle from '@/Components/Game/FullscreenToggle';
import {
    ArrowRightIcon,
    ChatBubbleIcon,
    CheckIcon,
    ChevronLeftIcon,
    CloseIcon,
    DiceIcon,
    HashIcon,
    LinkIcon,
    PawnIcon,
    PencilIcon,
    ShuffleIcon,
    SlidersIcon,
    TrophyIcon,
    UsersIcon,
} from '@/Components/Game/Icons';
import Logo from '@/Components/Game/Logo';
import LudoPin from '@/Components/Game/LudoPin';
import RoomChat from '@/Components/Game/RoomChat';
import {
    ALL_PLAYER_COLORS,
    ARENA_BACKGROUND_IMAGE,
    CharacterId,
    DEFAULT_CHARACTER_BY_COLOR,
    getCharacterConfig,
    PLAYER_CONFIG,
    PlayerColor,
    PlayerCount,
} from '@/lib/ludo';
import { playUiSound, unlockAudio } from '@/lib/sound';
import { useGameExitGuard } from '@/lib/useGameExitGuard';
import { hasCoarsePointer, useModalViewport } from '@/lib/useModalViewport';
import { User } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';

type CopyState = 'idle' | 'link' | 'error';
type ViewMode = 'lobby' | 'join';

type RoomPlayerData = {
    id: number;
    name: string;
    seat_color: PlayerColor | null;
    character?: CharacterId | string | null;
    is_ready: boolean;
    is_host: boolean;
    is_computer?: boolean;
    name_confirmed: boolean;
};

type RoomData = {
    code: string;
    host_advantage: boolean;
    max_players: PlayerCount;
    status: 'waiting' | 'started';
    players: RoomPlayerData[];
};

type RoomPageProps = {
    auth?: { user: User | null };
    mode?: 'create' | 'lobby' | 'join';
    room?: RoomData | null;
    me?: RoomPlayerData | null;
    roomError?: string | null;
    attemptedCode?: string | null;
    canCreateRoom?: boolean;
};

const PLAYER_COUNTS: PlayerCount[] = [2, 3, 4, 5, 6, 7];

function RoomSettingsSummary({
    playerCount,
    isHost,
    pending,
    randomizing = false,
    onSelectPlayerCount,
    vsComputer,
    onSelectOpponent,
    onRandomize,
}: {
    playerCount: PlayerCount;
    isHost: boolean;
    pending: boolean;
    randomizing?: boolean;
    onSelectPlayerCount: (count: PlayerCount) => void;
    vsComputer: boolean;
    onSelectOpponent: (computer: boolean) => void;
    onRandomize?: () => void;
}) {
    const controlsDisabled = !isHost || pending || randomizing;

    return (
        <>
            <fieldset
                className="mb-3"
                disabled={controlsDisabled}
                aria-busy={pending || randomizing}
            >
                <legend className="text-ink-muted text-xs font-medium">
                    Lawan
                </legend>
                <div className="segmented mt-1.5 grid grid-cols-2">
                    <button
                        type="button"
                        className="segmented-item min-h-11 px-2 text-xs"
                        aria-pressed={!vsComputer}
                        onClick={() => onSelectOpponent(false)}
                    >
                        MANUSIA
                    </button>
                    <button
                        type="button"
                        className="segmented-item min-h-11 px-2 text-xs"
                        aria-pressed={vsComputer}
                        onClick={() => onSelectOpponent(true)}
                    >
                        VS COMPUTER
                    </button>
                </div>
                {vsComputer && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-ink-muted text-xs">
                            Level Computer: MEDIUM
                        </p>
                        {isHost && onRandomize && (
                            <button
                                type="button"
                                disabled={controlsDisabled}
                                aria-busy={randomizing}
                                onClick={onRandomize}
                                className="btn btn-secondary btn-sm shrink-0 gap-1.5 px-2.5 text-xs"
                            >
                                {randomizing ? (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                        />
                                        <span>Mengacak…</span>
                                    </>
                                ) : (
                                    <>
                                        <ShuffleIcon className="h-3.5 w-3.5 shrink-0" />
                                        <span>Random</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </fieldset>
            <div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-ink-muted block text-xs font-medium">
                        Kapasitas pemain
                    </span>
                    {!isHost && (
                        <span className="text-ink-muted text-[10px] font-medium">
                            Diatur host
                        </span>
                    )}
                </div>
                <div className="segmented mt-1.5 grid grid-cols-3">
                    {PLAYER_COUNTS.map((count) => (
                        <button
                            key={count}
                            type="button"
                            disabled={controlsDisabled}
                            onClick={() => onSelectPlayerCount(count)}
                            aria-pressed={playerCount === count}
                            className="segmented-item px-1 text-[11px] sm:text-xs"
                        >
                            {count} Pemain
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

function normalizeCode(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
}

async function copyText(value: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);

            return true;
        }

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);

        return copied;
    } catch {
        return false;
    }
}

export default function Room() {
    const { room } = usePage().props as unknown as RoomPageProps;

    return <RoomContent key={room?.code ?? 'join'} />;
}

function RoomContent() {
    const page = usePage();
    const {
        mode: initialMode,
        room: serverRoom,
        me: serverMe,
        roomError,
        attemptedCode = null,
        canCreateRoom = false,
    } = page.props as unknown as RoomPageProps;

    const [liveRoom, setLiveRoom] = useState<RoomData | null>(
        serverRoom ?? null,
    );
    const [viewMode, setViewMode] = useState<ViewMode>(
        initialMode === 'join' || !serverRoom ? 'join' : 'lobby',
    );
    const [joinCode, setJoinCode] = useState(
        serverRoom?.code ?? attemptedCode ?? '',
    );
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
    const [createPasswordOpen, setCreatePasswordOpen] = useState(false);
    const [createPasswordError, setCreatePasswordError] = useState<
        string | null
    >(null);
    const [pendingAction, setPendingAction] = useState(false);
    const [randomizing, setRandomizing] = useState(false);
    const isBusy = pendingAction || randomizing;
    const [actionError, setActionError] = useState<string | null>(
        roomError ?? null,
    );
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(serverMe?.name ?? '');
    const [hostEditingPlayer, setHostEditingPlayer] =
        useState<RoomPlayerData | null>(null);
    const [hostNameDraft, setHostNameDraft] = useState('');
    const [hostNameError, setHostNameError] = useState<string | null>(null);
    const [renamingPlayerId, setRenamingPlayerId] = useState<number | null>(
        null,
    );
    const [characterModalOpen, setCharacterModalOpen] = useState(false);
    const [characterModalSeat, setCharacterModalSeat] =
        useState<PlayerColor | null>(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatUnread, setChatUnread] = useState(0);
    const advancedOverlayStyle = useModalViewport(advancedModalOpen);
    const hostRenameOverlayStyle = useModalViewport(hostEditingPlayer !== null);

    useEffect(() => {
        setLiveRoom(serverRoom ?? null);
        setViewMode(initialMode === 'join' || !serverRoom ? 'join' : 'lobby');
        if (serverRoom?.code) {
            setJoinCode(serverRoom.code);
        }
        // Partial reloads (fallback poll / broadcast) recreate the prop
        // identities every few seconds. Never let them clobber the draft
        // while the player is typing a new name — re-sync only once the
        // editor closes, using whatever name the server returned then.
        if (!editingName && serverMe?.name) {
            setNameDraft(serverMe.name);
        }
    }, [initialMode, serverRoom, serverMe, editingName]);

    useEffect(() => {
        setActionError(roomError ?? null);
    }, [roomError]);

    useEffect(() => {
        const previous = document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    useEffect(() => {
        if (!advancedModalOpen) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setAdvancedModalOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [advancedModalOpen]);

    useEffect(() => {
        if (!hostEditingPlayer) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && renamingPlayerId === null) {
                setHostEditingPlayer(null);
                setHostNameError(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [hostEditingPlayer, renamingPlayerId]);

    const roomCode = liveRoom?.code ?? null;
    const roomStatus = liveRoom?.status ?? 'waiting';

    // Real-time Reverb subscription for room state updates
    useEffect(() => {
        if (!roomCode || !echoIsConfigured()) {
            return;
        }

        const channelName = `room.${roomCode}`;
        const channel = echo().channel(channelName);

        channel.listen('.room.updated', (payload: { room?: RoomData }) => {
            if (payload?.room?.code === roomCode) {
                setLiveRoom(payload.room);
            }
        });

        return () => {
            echo().leave(channelName);
        };
    }, [roomCode]);

    const currentMe: RoomPlayerData | null =
        liveRoom?.players.find((p) => p.id === serverMe?.id) ??
        serverMe ??
        null;
    const isHost = Boolean(currentMe?.is_host);
    const requiredNameModalOpen =
        Boolean(
            liveRoom &&
                currentMe?.seat_color &&
                !currentMe.name_confirmed &&
                liveRoom.status === 'waiting',
        ) && !characterModalOpen;

    // Lightweight fallback sync while waiting in lobby. Paused whenever a
    // mutating request is in flight or the required-name modal is open: a
    // reload cancels Inertia's pending request, so an in-flight name save
    // (or seat/ready/patch action) would be silently dropped and the lobby
    // would snap back to the old server state.
    useEffect(() => {
        if (
            !roomCode ||
            roomStatus !== 'waiting' ||
            viewMode !== 'lobby' ||
            isBusy ||
            renamingPlayerId !== null ||
            requiredNameModalOpen
        ) {
            return;
        }

        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                router.reload({
                    only: ['room', 'me', 'roomError', 'attemptedCode'],
                });
            }
        }, 4000);

        return () => window.clearInterval(interval);
    }, [
        roomCode,
        roomStatus,
        viewMode,
        isBusy,
        renamingPlayerId,
        requiredNameModalOpen,
    ]);

    // Auto-redirect all players when host starts the match
    useEffect(() => {
        if (liveRoom?.status === 'started' && liveRoom.code) {
            router.visit(route('play', { room: liveRoom.code }));
        }
    }, [liveRoom?.status, liveRoom?.code]);

    const cue = () => {
        void unlockAudio().then(playUiSound);
    };

    const seatedInLobby =
        viewMode === 'lobby' &&
        Boolean(liveRoom) &&
        Boolean(currentMe) &&
        liveRoom?.status === 'waiting';
    const exitGuard = useGameExitGuard(
        seatedInLobby,
        route('home'),
        `room:${liveRoom?.code ?? 'none'}`,
    );
    const playerCount: PlayerCount = liveRoom?.max_players ?? 4;
    const allColorSeats = ALL_PLAYER_COLORS;
    const players = liveRoom?.players ?? [];
    const vsComputer = players.some((player) => player.is_computer);
    const occupiedCount = players.length;
    const seatedCount = players.filter((p) => p.seat_color !== null).length;
    const readyCount = players.filter((p) => p.is_ready).length;
    const allSeated =
        players.length > 0 && players.every((p) => p.seat_color !== null);
    const allCharactersPicked =
        players.length > 0 &&
        players.every((p) => p.is_computer || Boolean(p.character));
    const allReady =
        players.length >= 2 &&
        allSeated &&
        allCharactersPicked &&
        players.every((p) => p.is_ready && (p.is_computer || p.name_confirmed));
    const waitingForNames = players.some(
        (p) => !p.is_computer && !p.name_confirmed,
    );

    const takenCharacters = useMemo(() => {
        const map: Partial<Record<CharacterId, string>> = {};
        for (const p of players) {
            if (p.id !== currentMe?.id && p.character) {
                map[p.character as CharacterId] = p.name;
            }
        }
        return map;
    }, [players, currentMe?.id]);

    const startBlockedReason =
        players.length < 2
            ? 'Menunggu minimal 2 pemain bergabung ke ruang.'
            : !allSeated
              ? 'Tunggu semua pemain memilih warna home base dan duduk.'
              : !allCharactersPicked
                ? 'Tunggu semua pemain memilih karakter.'
                : waitingForNames
                  ? 'Menunggu semua pemain mengisi nama.'
                  : !allReady
                    ? `Menunggu semua pemain siap (${readyCount}/${players.length} siap).`
                    : null;

    const joinBlocked =
        !liveRoom && Boolean(actionError) && Boolean(attemptedCode);

    const shareLink = liveRoom ? route('room', { code: liveRoom.code }) : '';

    const copy = async (value: string, target: 'link') => {
        if (!value) {
            return;
        }
        cue();
        const copied = await copyText(value);
        setCopyState(copied ? target : 'error');
        window.setTimeout(() => setCopyState('idle'), 1800);
    };

    const handleFirstError = (errors: Record<string, string>) => {
        const first = Object.values(errors)[0];
        if (first) {
            setActionError(first);
        }
    };

    const handleSelectPlayerCount = (count: PlayerCount) => {
        if (!liveRoom || !isHost || isBusy || count === playerCount) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.patch(
            route('rooms.settings', { code: liveRoom.code }),
            { max_players: count },
            {
                preserveScroll: true,
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleToggleAdvantage = () => {
        if (!liveRoom || !isHost || isBusy) return;
        const next = !liveRoom.host_advantage;
        cue();
        setActionError(null);
        setPendingAction(true);
        router
            .optimistic((props: RoomPageProps) => ({
                room: { ...(props.room as RoomData), host_advantage: next },
            }))
            .patch(
                route('rooms.settings', { code: liveRoom.code }),
                { host_advantage: next },
                {
                    preserveScroll: true,
                    onError: handleFirstError,
                    onFinish: () => setPendingAction(false),
                },
            );
    };

    const handleSelectOpponent = (computer: boolean) => {
        if (!liveRoom || !isHost || isBusy || vsComputer === computer) return;
        setActionError(null);
        setPendingAction(true);
        router.patch(
            route('rooms.settings', { code: liveRoom.code }),
            { vs_computer: computer },
            {
                preserveScroll: true,
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleRandomize = () => {
        if (!liveRoom || !isHost || !vsComputer || isBusy) {
            return;
        }
        cue();
        setActionError(null);
        setRandomizing(true);
        router.post(
            route('rooms.randomize', { code: liveRoom.code }),
            {},
            {
                preserveScroll: true,
                onError: handleFirstError,
                onFinish: () => setRandomizing(false),
            },
        );
    };

    const handleSelectSeat = (
        color: PlayerColor | null,
        character?: CharacterId,
    ) => {
        if (!liveRoom || isBusy) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.seat', { code: liveRoom.code }),
            {
                seat_color: color,
                ...(character ? { character } : {}),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (color !== null && !character) {
                        setCharacterModalSeat(color);
                        setCharacterModalOpen(true);
                    } else {
                        setCharacterModalOpen(false);
                    }
                },
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const openCharacterPickerForSeat = (color: PlayerColor) => {
        if (!liveRoom || isBusy) {
            return;
        }
        cue();
        setActionError(null);
        setCharacterModalSeat(color);
        setCharacterModalOpen(true);
    };

    const handleConfirmCharacter = (
        character: CharacterId,
        seatColor: PlayerColor | null,
    ) => {
        const targetSeat =
            seatColor ??
            currentMe?.seat_color ??
            allColorSeats.find(
                (seat) => !players.some((p) => p.seat_color === seat),
            ) ??
            allColorSeats[0];

        handleSelectSeat(targetSeat, character);
    };

    const handleToggleReady = () => {
        if (!liveRoom || isBusy) {
            return;
        }
        if (!currentMe?.seat_color) {
            setActionError(
                'Pilih kursi terlebih dahulu sebelum menandai siap.',
            );
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.ready', { code: liveRoom.code }),
            { is_ready: !currentMe.is_ready },
            {
                preserveScroll: true,
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleStartMatch = () => {
        if (!liveRoom || !isHost || !allReady || isBusy) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.start', { code: liveRoom.code }),
            {},
            {
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleSaveName = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!liveRoom || !nameDraft.trim() || isBusy) {
            return;
        }
        cue();
        setActionError(null);
        setPendingAction(true);
        router.post(
            route('rooms.name', { code: liveRoom.code }),
            { name: nameDraft.trim() },
            {
                preserveScroll: true,
                onSuccess: () => setEditingName(false),
                onError: handleFirstError,
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const openHostEditName = (player: RoomPlayerData) => {
        if (!isHost || isBusy || renamingPlayerId !== null) {
            return;
        }
        cue();
        setActionError(null);
        setHostNameError(null);
        setHostEditingPlayer(player);
        setHostNameDraft(player.name);
    };

    const handleHostSavePlayerName = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (
            !liveRoom ||
            !isHost ||
            !hostEditingPlayer ||
            renamingPlayerId !== null
        ) {
            return;
        }

        const trimmed = hostNameDraft.trim();
        if (!trimmed) {
            setHostNameError('Nama pemain tidak boleh kosong.');
            return;
        }

        const targetId = hostEditingPlayer.id;
        cue();
        setActionError(null);
        setHostNameError(null);
        setRenamingPlayerId(targetId);

        router
            .optimistic((props: RoomPageProps) => {
                if (!props.room) {
                    return {};
                }

                return {
                    room: {
                        ...props.room,
                        players: props.room.players.map((player) =>
                            player.id === targetId
                                ? { ...player, name: trimmed }
                                : player,
                        ),
                    },
                    ...(props.me?.id === targetId
                        ? { me: { ...props.me, name: trimmed } }
                        : {}),
                };
            })
            .patch(
                route('rooms.players.name', {
                    code: liveRoom.code,
                    player: targetId,
                }),
                { name: trimmed },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setHostEditingPlayer(null);
                        setHostNameError(null);
                    },
                    onError: (errors) => {
                        const first =
                            errors.name ??
                            Object.values(errors)[0] ??
                            'Gagal mengganti nama pemain.';
                        setHostNameError(first);
                    },
                    onFinish: () => setRenamingPlayerId(null),
                },
            );
    };

    const postRoomCreation = (password?: string, vsComputer = false) => {
        setActionError(null);
        setCreatePasswordError(null);
        setPendingAction(true);
        router.post(
            route('rooms.store'),
            {
                max_players: playerCount,
                vs_computer: vsComputer,
                ...(password === undefined ? {} : { password }),
            },
            {
                onError: (errors) => {
                    const first =
                        errors.password ??
                        Object.values(errors)[0] ??
                        'Kata sandi salah. Periksa kembali lalu coba lagi.';
                    setActionError(first);

                    if (password !== undefined) {
                        setCreatePasswordError(first);
                    }
                },
                onSuccess: () => setCreatePasswordOpen(false),
                onFinish: () => setPendingAction(false),
            },
        );
    };

    const handleCreateNewRoom = () => {
        if (pendingAction) {
            return;
        }
        cue();
        setActionError(null);
        setCreatePasswordError(null);

        setCreatePasswordOpen(true);
    };

    const handleJoin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (joinCode.length !== 6) {
            return;
        }

        cue();
        setActionError(null);
        router.get(route('room'), { code: joinCode });
    };

    const switchMode = (next: ViewMode) => {
        cue();
        if (next === 'lobby' && !liveRoom) {
            if (!canCreateRoom) {
                setActionError(null);
                setCreatePasswordError(null);
                setCreatePasswordOpen(true);
                return;
            }
            router.get(route('room'));
            return;
        }
        setViewMode(next);
    };

    return (
        <>
            <Head title="Ruang privat" />

            <div className="bg-canvas relative flex h-screen min-h-0 w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]">
                {/* Full-bleed Arena Background Image */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url('${ARENA_BACKGROUND_IMAGE}')`,
                    }}
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-950/15 via-white/30 to-white/65 backdrop-blur-[1.5px]"
                />

                <header className="relative z-20 shrink-0 border-b border-white/60 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
                    <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:h-14 sm:px-6">
                        <div className="flex min-w-0 items-center gap-2">
                            <Link
                                href={route('home')}
                                onClick={exitGuard.blockLink}
                                aria-label="Kembali ke beranda"
                                className="btn btn-secondary btn-sm btn-icon shrink-0"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Link>
                            <Link
                                href={route('home')}
                                onClick={exitGuard.blockLink}
                                aria-label="Beranda Ludo Arena"
                                className="shrink-0 rounded-lg"
                            >
                                <span className="inline-flex min-[430px]:hidden">
                                    <Logo className="h-7 w-7" />
                                </span>
                                <span className="hidden min-[430px]:inline-flex">
                                    <Logo
                                        className="h-7 w-7"
                                        withWordmark
                                        compact
                                    />
                                </span>
                            </Link>

                        </div>

                        <div
                            className="segmented shrink-0"
                            role="tablist"
                            aria-label="Mode ruang"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={viewMode === 'lobby'}
                                onClick={() => switchMode('lobby')}
                                className="segmented-item min-h-8 px-2.5 sm:min-h-9 sm:px-3"
                            >
                                Meja
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={viewMode === 'join'}
                                onClick={() => switchMode('join')}
                                className="segmented-item min-h-8 px-2.5 sm:min-h-9 sm:px-3"
                            >
                                Gabung
                            </button>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                            {viewMode === 'lobby' && liveRoom && isHost && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        cue();
                                        setAdvancedModalOpen(true);
                                    }}
                                    aria-label="Advanced"
                                    className="btn btn-secondary btn-sm min-w-9 px-2 min-[360px]:px-2.5"
                                >
                                    <SlidersIcon className="h-3.5 w-3.5" />
                                    <span className="hidden min-[360px]:inline">
                                        Advanced
                                    </span>
                                </button>
                            )}
                            <span className="border-line text-ink-muted hidden items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-semibold sm:inline-flex">
                                <span
                                    className={`h-2 w-2 rounded-full ${
                                        allReady
                                            ? 'bg-ludo-green'
                                            : 'bg-warning'
                                    }`}
                                />
                                {allReady
                                    ? 'Semua siap'
                                    : `${readyCount}/${occupiedCount} Siap`}
                            </span>
                            <FullscreenToggle className="btn btn-secondary btn-sm btn-icon" />
                        </div>
                    </div>
                </header>

                {joinBlocked ? (
                    <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
                        <div className="animate-modal-enter shadow-card w-full max-w-md rounded-[24px] border border-white/85 bg-white/95 p-5 backdrop-blur-md sm:p-7">
                            <div className="flex items-center gap-3">
                                <span className="bg-danger/10 text-danger grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                                    <HashIcon className="h-5.5 w-5.5" />
                                </span>
                                <div className="min-w-0">
                                    <h1 className="text-ink text-lg font-semibold tracking-tight sm:text-xl">
                                        Tidak bisa bergabung
                                    </h1>
                                    <p className="text-ink-muted text-xs sm:text-sm">
                                        Tautan ruang{' '}
                                        <span className="text-ink font-mono font-semibold tracking-[0.12em]">
                                            {attemptedCode}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <p
                                role="alert"
                                className="bg-danger/10 text-danger mt-4 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed font-semibold"
                            >
                                {actionError}
                            </p>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                                <Link
                                    href={route('home')}
                                    className="btn btn-secondary flex-1"
                                >
                                    Kembali ke beranda
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActionError(null);
                                        setJoinCode('');
                                    }}
                                    className="btn btn-primary flex-1"
                                >
                                    Masukkan kode lain
                                </button>
                            </div>
                        </div>
                    </main>
                ) : viewMode === 'join' || !liveRoom ? (
                    <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
                        <div className="animate-modal-enter shadow-card w-full max-w-md rounded-[24px] border border-white/85 bg-white/95 p-5 backdrop-blur-md sm:p-7">
                            <div className="flex items-center gap-3">
                                <span className="bg-brand/10 text-brand-ink grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                                    <HashIcon className="h-5.5 w-5.5" />
                                </span>
                                <div>
                                    <h1 className="text-ink text-lg font-semibold tracking-tight sm:text-xl">
                                        Gabung ruang privat
                                    </h1>
                                    <p className="text-ink-muted text-xs sm:text-sm">
                                        Masukkan 6 karakter kode undangan.
                                    </p>
                                </div>
                            </div>

                            {actionError && (
                                <p
                                    role="alert"
                                    className="bg-danger/10 text-danger mt-4 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
                                >
                                    {actionError}
                                </p>
                            )}

                            <form onSubmit={handleJoin} className="mt-5">
                                <label
                                    htmlFor="room-code"
                                    className="text-ink block text-xs font-semibold"
                                >
                                    Kode ruang
                                </label>
                                <input
                                    id="room-code"
                                    value={joinCode}
                                    onChange={(event) =>
                                        setJoinCode(
                                            normalizeCode(event.target.value),
                                        )
                                    }
                                    inputMode="text"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    spellCheck={false}
                                    maxLength={6}
                                    placeholder="ABC123"
                                    aria-label="Kode ruang enam karakter"
                                    className="border-line bg-canvas text-ink placeholder:text-ink-muted/35 focus:border-brand focus:ring-brand/10 mt-2 h-15 w-full rounded-2xl border px-4 text-center font-mono text-2xl font-semibold tracking-[0.34em] uppercase transition focus:bg-white focus:ring-4 focus:outline-none sm:h-16 sm:text-3xl"
                                />

                                <div
                                    className="mt-3 grid grid-cols-6 gap-1.5"
                                    aria-hidden="true"
                                >
                                    {[0, 1, 2, 3, 4, 5].map((index) => (
                                        <span
                                            key={index}
                                            className={`h-1 rounded-full transition-colors ${
                                                index < joinCode.length
                                                    ? 'bg-brand'
                                                    : 'bg-line'
                                            }`}
                                        />
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    disabled={joinCode.length !== 6}
                                    className="btn btn-primary mt-5 min-h-12 w-full gap-2 rounded-[14px] text-sm"
                                >
                                    Masuk ke ruang
                                    <ArrowRightIcon className="h-4 w-4" />
                                </button>
                            </form>

                            <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-xs">
                                <span className="text-ink-muted">
                                    Belum punya kode?
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCreateNewRoom}
                                    disabled={pendingAction}
                                    aria-busy={pendingAction}
                                    className="btn btn-secondary btn-sm text-brand-ink"
                                >
                                    {pendingAction ? (
                                        <>
                                            <span
                                                aria-hidden="true"
                                                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                                            />
                                            Membuat ruang…
                                        </>
                                    ) : (
                                        'Buat ruang baru'
                                    )}
                                </button>
                            </div>
                        </div>
                    </main>
                ) : (
                    <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl min-w-0 flex-1 flex-col pt-2 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(10px,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:px-6 sm:pt-3 sm:pb-4">
                        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-2 sm:gap-3.5 md:my-auto md:max-h-[700px] md:grid-cols-[minmax(0,1fr)_316px] lg:grid-cols-[minmax(0,1fr)_344px]">
                            <section className="flex min-h-0 min-w-0 flex-col gap-2 sm:gap-2.5 [@media(orientation:landscape)_and_(max-height:520px)]:overflow-y-auto">
                                {/* Room code banner */}
                                <div className="shadow-card relative flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 overflow-hidden rounded-2xl border border-white/85 bg-white/92 px-2.5 py-2 backdrop-blur-md sm:px-4 sm:py-2.5">
                                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="border-line bg-canvas text-ink inline-flex items-baseline gap-1.5 rounded-lg border px-2 py-0.5 sm:px-2.5">
                                                    <span className="text-ink-muted text-[10px] font-semibold tracking-wide uppercase">
                                                        Ruang
                                                    </span>
                                                    <span className="font-mono text-xs font-bold tracking-[0.06em] sm:text-sm">
                                                        #{liveRoom.code}
                                                    </span>
                                                </span>
                                                <span className="border-line bg-canvas text-ink-muted inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                                                    <UsersIcon className="h-3 w-3" />
                                                    {occupiedCount}/
                                                    {playerCount}
                                                </span>
                                            </div>
                                            <p className="text-ink-muted mt-1 truncate text-[11px] font-medium">
                                                {!allSeated
                                                    ? 'Pilih warna home base dulu, lalu duduk untuk memilih karakter…'
                                                    : !allCharactersPicked
                                                      ? 'Semua sudah duduk! Sekarang pilih karakter masing-masing…'
                                                      : allReady
                                                        ? 'Semua pemain siap bertanding!'
                                                        : 'Menunggu semua pemain siap bertanding…'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5">
                                        {vsComputer && isHost && (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                aria-busy={randomizing}
                                                onClick={handleRandomize}
                                                className="btn btn-secondary min-h-10 gap-1.5 px-2.5 sm:min-h-11 sm:px-3 md:hidden"
                                            >
                                                {randomizing ? (
                                                    <>
                                                        <span
                                                            aria-hidden="true"
                                                            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                                        />
                                                        <span>Mengacak…</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShuffleIcon className="h-3.5 w-3.5 shrink-0" />
                                                        <span>Random</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        {currentMe?.seat_color && (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() =>
                                                    openCharacterPickerForSeat(
                                                        currentMe.seat_color!,
                                                    )
                                                }
                                                className="btn btn-secondary min-h-10 px-2.5 sm:min-h-11 sm:px-3"
                                            >
                                                <PawnIcon className="h-4 w-4" />
                                                <span className="hidden min-[420px]:inline">
                                                    {currentMe.character
                                                        ? 'Ganti Karakter'
                                                        : 'Pilih Karakter'}
                                                </span>
                                                <span className="min-[420px]:hidden">
                                                    Karakter
                                                </span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copy(shareLink, 'link')
                                            }
                                            aria-label="Undang teman dengan menyalin tautan ruang"
                                            className="btn btn-secondary min-h-10 min-w-10 px-2.5 sm:min-h-11 sm:min-w-11 sm:px-3.5"
                                        >
                                            {copyState === 'link' ? (
                                                <>
                                                    <CheckIcon className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">
                                                        Tautan tersalin
                                                    </span>
                                                    <span className="sm:hidden">
                                                        Tersalin
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <LinkIcon className="h-3.5 w-3.5" />
                                                    <span className="hidden min-[440px]:inline">
                                                        Undang Teman
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Joined players & display name bar */}
                                <div className="shadow-card flex min-w-0 shrink-0 items-center justify-between gap-2 rounded-2xl border border-white/85 bg-white/92 px-2.5 py-2 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2.5">
                                    <div
                                        className={`min-w-0 flex-1 ${editingName ? 'hidden sm:block' : ''}`}
                                    >
                                        <p className="text-ink-muted text-[11px] leading-none font-semibold">
                                            Pemain ({occupiedCount}/
                                            {playerCount})
                                        </p>
                                        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
                                            {players.map((player) => {
                                                const seatCfg =
                                                    player.seat_color
                                                        ? PLAYER_CONFIG[
                                                              player.seat_color
                                                          ]
                                                        : null;
                                                const charCfg =
                                                    player.seat_color &&
                                                    player.character
                                                        ? getCharacterConfig(
                                                              player.character,
                                                              player.seat_color,
                                                          )
                                                        : null;
                                                const pillContent = (
                                                    <>
                                                        {charCfg ? (
                                                            <img
                                                                src={
                                                                    charCfg.image
                                                                }
                                                                alt={
                                                                    charCfg.name
                                                                }
                                                                width={18}
                                                                height={18}
                                                                className="h-4.5 w-4.5 shrink-0 rounded-full object-cover ring-1 ring-black/10"
                                                            />
                                                        ) : (
                                                            <span
                                                                className="h-2 w-2 shrink-0 rounded-full"
                                                                style={{
                                                                    backgroundColor:
                                                                        seatCfg
                                                                            ? seatCfg
                                                                                  .palette
                                                                                  .base
                                                                            : '#94A3B8',
                                                                }}
                                                            />
                                                        )}
                                                        <span className="text-ink max-w-[92px] truncate sm:max-w-[128px]">
                                                            {player.name}
                                                        </span>
                                                        {player.is_host && (
                                                            <span className="text-warning-ink text-[10px] font-bold">
                                                                (Host)
                                                            </span>
                                                        )}
                                                        {player.id ===
                                                            currentMe?.id &&
                                                            !player.is_host && (
                                                                <span className="text-ink-muted">
                                                                    (Kamu)
                                                                </span>
                                                            )}
                                                        <span
                                                            className={
                                                                player.is_ready
                                                                    ? 'text-success-ink'
                                                                    : 'text-ink-muted'
                                                            }
                                                        >
                                                            {player.is_ready
                                                                ? '· Siap'
                                                                : player.seat_color
                                                                  ? ''
                                                                  : '· Pilih kursi'}
                                                        </span>
                                                        {isHost && (
                                                            <PencilIcon className="text-ink-muted h-3 w-3 shrink-0" />
                                                        )}
                                                    </>
                                                );

                                                if (isHost) {
                                                    return (
                                                        <button
                                                            key={player.id}
                                                            type="button"
                                                            disabled={
                                                                isBusy ||
                                                                renamingPlayerId ===
                                                                    player.id
                                                            }
                                                            aria-busy={
                                                                renamingPlayerId ===
                                                                player.id
                                                            }
                                                            aria-label={`Ganti nama ${player.name}`}
                                                            title={`Ganti nama ${player.name}`}
                                                            onClick={() =>
                                                                openHostEditName(
                                                                    player,
                                                                )
                                                            }
                                                            className="chip-btn sm:text-xs"
                                                        >
                                                            {pillContent}
                                                        </button>
                                                    );
                                                }

                                                return (
                                                    <span
                                                        key={player.id}
                                                        className="border-line bg-canvas inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 text-[11px] font-semibold sm:text-xs"
                                                    >
                                                        {pillContent}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {currentMe &&
                                        (editingName ? (
                                            <form
                                                onSubmit={handleSaveName}
                                                className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center"
                                            >
                                                <label
                                                    htmlFor="player-display-name"
                                                    className="text-ink-muted text-[11px] leading-none font-medium sm:hidden"
                                                >
                                                    Ubah nama tampilan
                                                </label>
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <input
                                                        id="player-display-name"
                                                        type="text"
                                                        autoFocus
                                                        value={nameDraft}
                                                        onChange={(e) =>
                                                            setNameDraft(
                                                                e.target.value.slice(
                                                                    0,
                                                                    24,
                                                                ),
                                                            )
                                                        }
                                                        maxLength={24}
                                                        aria-label="Nama tampilan"
                                                        className="border-line bg-canvas text-ink focus:border-brand h-10 min-w-0 flex-1 rounded-xl border px-2.5 text-base font-medium focus:bg-white focus:outline-none sm:h-11 sm:w-36 sm:flex-none"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={
                                                            !nameDraft.trim() ||
                                                            pendingAction
                                                        }
                                                        aria-busy={
                                                            pendingAction
                                                        }
                                                        className="btn btn-primary min-h-10 shrink-0 px-3 sm:min-h-11"
                                                    >
                                                        {pendingAction ? (
                                                            <>
                                                                <span
                                                                    aria-hidden="true"
                                                                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                                                                />
                                                                Menyimpan…
                                                            </>
                                                        ) : (
                                                            'Simpan'
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingName(
                                                                false,
                                                            );
                                                            setNameDraft(
                                                                currentMe.name,
                                                            );
                                                        }}
                                                        className="btn btn-quiet min-h-10 shrink-0 px-2.5 sm:min-h-11"
                                                    >
                                                        Batal
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNameDraft(
                                                        currentMe.name,
                                                    );
                                                    setEditingName(true);
                                                }}
                                                className="btn btn-secondary min-h-10 shrink-0 px-2.5 sm:min-h-11 sm:px-3.5"
                                            >
                                                Ubah nama
                                            </button>
                                        ))}
                                </div>

                                {actionError && (
                                    <p
                                        role="alert"
                                        className="bg-danger/10 text-danger shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold"
                                    >
                                        {actionError}
                                    </p>
                                )}

                                <div
                                    className="relative grid min-h-0 min-w-0 flex-1 auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4 [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[min(75dvh,320px)] [@media(orientation:landscape)_and_(max-height:520px)]:flex-none"
                                    role="group"
                                    aria-label="Pilih warna home base Ludo"
                                >
                                    {allColorSeats.map((color) => {
                                        const config = PLAYER_CONFIG[color];
                                        const palette = config.palette;
                                        const occupant = players.find(
                                            (p) => p.seat_color === color,
                                        );
                                        const isYou =
                                            occupant !== undefined &&
                                            occupant.id === currentMe?.id;
                                        const occupied = Boolean(occupant);
                                        const hasCharacter = Boolean(
                                            occupant?.character,
                                        );
                                        const seatCharacter = hasCharacter
                                            ? getCharacterConfig(
                                                  occupant?.character,
                                                  color,
                                              )
                                            : null;
                                        const capacityFull =
                                            !occupied &&
                                            !currentMe?.seat_color &&
                                            seatedCount >= playerCount;

                                        const tokenStyle = {
                                            '--token-light': palette.light,
                                            '--token-base': palette.base,
                                            '--token-dark': palette.dark,
                                        } as CSSProperties;

                                        return (
                                            <div
                                                key={color}
                                                className={`relative flex min-h-0 min-w-0 flex-col justify-between rounded-[18px] border p-2 transition sm:rounded-[20px] sm:p-2.5 ${
                                                    occupied
                                                        ? 'shadow-card border-white/90 bg-white/95 backdrop-blur-md'
                                                        : 'border-white/80 bg-white/86 backdrop-blur-sm hover:bg-white/95'
                                                }`}
                                                style={
                                                    isYou
                                                        ? {
                                                              borderColor: `${palette.base}88`,
                                                              background: `linear-gradient(180deg, ${palette.soft}90 0%, rgba(255,255,255,0.96) 58%)`,
                                                          }
                                                        : undefined
                                                }
                                            >
                                                <div className="flex min-w-0 items-center justify-between gap-1">
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <LudoPin
                                                            className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                                                            style={tokenStyle}
                                                            pionImage={
                                                                seatCharacter
                                                                    ? seatCharacter.pion
                                                                    : undefined
                                                            }
                                                        />
                                                        <span
                                                            className="truncate text-xs font-bold sm:text-sm"
                                                            style={{
                                                                color: palette.text,
                                                            }}
                                                        >
                                                            {config.label}
                                                        </span>
                                                    </div>

                                                    {occupant ? (
                                                        <span
                                                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px] ${
                                                                occupant.is_ready
                                                                    ? 'bg-success/12 text-success-ink'
                                                                    : 'bg-warning/12 text-warning-ink'
                                                            }`}
                                                        >
                                                            {occupant.is_ready && (
                                                                <CheckIcon className="h-3 w-3" />
                                                            )}
                                                            {occupant.is_ready
                                                                ? 'Siap'
                                                                : hasCharacter
                                                                  ? 'Belum siap'
                                                                  : 'Pilih karakter'}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold sm:text-[10px]"
                                                            style={{
                                                                backgroundColor:
                                                                    capacityFull
                                                                        ? '#f1f5f9'
                                                                        : palette.soft,
                                                                color: capacityFull
                                                                    ? '#64748b'
                                                                    : palette.text,
                                                            }}
                                                        >
                                                            {capacityFull
                                                                ? 'Penuh'
                                                                : 'Tersedia'}
                                                        </span>
                                                    )}
                                                </div>

                                                {seatCharacter ? (
                                                    <div
                                                        className="room-seat-scene max-h-20 sm:max-h-24"
                                                        style={tokenStyle}
                                                        aria-hidden="true"
                                                    >
                                                        <div className="room-seat-piece room-seat-piece-occupied">
                                                            <img
                                                                src={
                                                                    seatCharacter.image
                                                                }
                                                                alt=""
                                                                width={180}
                                                                height={180}
                                                                className="room-seat-token object-contain drop-shadow-[0_6px_10px_rgba(20,32,52,0.28)]"
                                                            />
                                                            <span className="room-seat-piece-base" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="my-1 flex min-h-0 flex-1 items-center justify-center"
                                                        aria-hidden="true"
                                                    >
                                                        <div
                                                            className="grid aspect-square h-full max-h-14 w-auto grid-cols-2 gap-1.5 rounded-2xl border-2 p-2 shadow-inner sm:max-h-16 sm:gap-2 sm:p-2.5"
                                                            style={{
                                                                backgroundColor:
                                                                    palette.soft,
                                                                borderColor: `${palette.base}66`,
                                                            }}
                                                        >
                                                            {[0, 1, 2, 3].map(
                                                                (pad) => (
                                                                    <span
                                                                        key={
                                                                            pad
                                                                        }
                                                                        className="h-full w-full rounded-full shadow-sm ring-2 ring-white/90"
                                                                        style={{
                                                                            background: `radial-gradient(circle at 32% 30%, ${palette.light}, ${palette.base} 70%, ${palette.dark})`,
                                                                        }}
                                                                    />
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {occupant ? (
                                                    <div
                                                        className={`mt-auto flex min-w-0 gap-1.5 pt-1 ${
                                                            isYou
                                                                ? 'flex-col'
                                                                : 'items-center justify-between'
                                                        }`}
                                                    >
                                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                                            {seatCharacter ? (
                                                                <div
                                                                    className="relative hidden h-7 w-7 shrink-0 rounded-full p-[2px] min-[400px]:block sm:h-8 sm:w-8"
                                                                    style={{
                                                                        background: `linear-gradient(135deg, ${palette.base}, ${palette.dark})`,
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={
                                                                            seatCharacter.image
                                                                        }
                                                                        alt={
                                                                            seatCharacter.name
                                                                        }
                                                                        width={
                                                                            32
                                                                        }
                                                                        height={
                                                                            32
                                                                        }
                                                                        className="h-full w-full rounded-full bg-white object-cover"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span
                                                                    className="hidden h-7 w-7 shrink-0 rounded-full border-2 border-white shadow-sm min-[400px]:block"
                                                                    style={{
                                                                        backgroundColor:
                                                                            palette.base,
                                                                    }}
                                                                />
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-ink truncate text-xs font-bold sm:text-sm">
                                                                    {
                                                                        occupant.name
                                                                    }
                                                                </p>
                                                                <p className="text-ink-muted truncate text-[10px] leading-tight">
                                                                    {seatCharacter
                                                                        ? `${seatCharacter.name} · `
                                                                        : ''}
                                                                    {isYou
                                                                        ? occupant.is_host
                                                                            ? 'Kamu (Host)'
                                                                            : 'Kamu'
                                                                        : occupant.is_host
                                                                          ? 'Host'
                                                                          : 'Pemain'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {isYou && (
                                                            <div className="flex min-w-0 items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        isBusy
                                                                    }
                                                                    onClick={() =>
                                                                        openCharacterPickerForSeat(
                                                                            color,
                                                                        )
                                                                    }
                                                                    aria-label={
                                                                        hasCharacter
                                                                            ? 'Ganti karakter'
                                                                            : 'Pilih karakter'
                                                                    }
                                                                    title={
                                                                        hasCharacter
                                                                            ? 'Ganti karakter'
                                                                            : 'Pilih karakter'
                                                                    }
                                                                    className={`btn min-h-9 min-w-0 flex-1 gap-1 px-2 text-xs sm:min-h-10 ${
                                                                        hasCharacter
                                                                            ? 'btn-secondary'
                                                                            : 'btn-primary'
                                                                    }`}
                                                                >
                                                                    <PawnIcon className="h-3.5 w-3.5 shrink-0" />
                                                                    <span className="truncate">
                                                                        Karakter
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        isBusy
                                                                    }
                                                                    onClick={() =>
                                                                        handleSelectSeat(
                                                                            null,
                                                                        )
                                                                    }
                                                                    className="btn btn-quiet min-h-9 shrink-0 px-2.5 text-xs sm:min-h-10"
                                                                >
                                                                    Berdiri
                                                                </button>
                                                            </div>
                                                        )}

                                                        {isHost && !isYou && (
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    isBusy ||
                                                                    renamingPlayerId ===
                                                                        occupant.id
                                                                }
                                                                aria-busy={
                                                                    renamingPlayerId ===
                                                                    occupant.id
                                                                }
                                                                onClick={() =>
                                                                    openHostEditName(
                                                                        occupant,
                                                                    )
                                                                }
                                                                aria-label={`Ganti nama ${occupant.name}`}
                                                                title={`Ganti nama ${occupant.name}`}
                                                                className="btn btn-secondary btn-icon min-h-10 w-10 shrink-0 sm:min-h-11 sm:w-11"
                                                            >
                                                                {renamingPlayerId ===
                                                                occupant.id ? (
                                                                    <span
                                                                        aria-hidden="true"
                                                                        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                                                    />
                                                                ) : (
                                                                    <PencilIcon className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="mt-auto flex min-w-0 items-center pt-1">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                isBusy ||
                                                                capacityFull
                                                            }
                                                            onClick={() =>
                                                                handleSelectSeat(
                                                                    color,
                                                                )
                                                            }
                                                            className="btn btn-seat min-h-10 w-full min-w-0 gap-1.5 px-2.5 text-xs sm:min-h-11 sm:text-sm"
                                                            style={
                                                                {
                                                                    '--seat-base':
                                                                        palette.base,
                                                                    '--seat-soft':
                                                                        palette.soft,
                                                                    '--seat-text':
                                                                        palette.text,
                                                                } as CSSProperties
                                                            }
                                                        >
                                                            <span
                                                                aria-hidden="true"
                                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                                style={{
                                                                    backgroundColor:
                                                                        palette.base,
                                                                }}
                                                            />
                                                            <span className="truncate">
                                                                {capacityFull
                                                                    ? 'Slot Penuh'
                                                                    : currentMe?.seat_color
                                                                      ? 'Pindah ke Sini'
                                                                      : 'Pilih Warna'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <aside className="hidden min-h-0 flex-col md:flex">
                                <section className="shadow-card flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[22px] border border-white/85 bg-white/94 p-4 backdrop-blur-md">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <h1 className="text-ink text-base font-bold tracking-tight">
                                            Pemain ({occupiedCount}/
                                            {playerCount})
                                        </h1>
                                        {isHost ? (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={handleCreateNewRoom}
                                                className="btn btn-quiet btn-sm text-[11px]"
                                            >
                                                Ruang baru
                                            </button>
                                        ) : (
                                            <span className="bg-surface-muted text-ink-muted rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                                Tamu
                                            </span>
                                        )}
                                    </div>

                                    {/* Visual Player Roster */}
                                    <ul className="divide-line border-line mb-3.5 divide-y rounded-2xl border bg-white px-3">
                                        {players.map((p) => {
                                            const seatCfg = p.seat_color
                                                ? PLAYER_CONFIG[p.seat_color]
                                                : null;
                                            const charCfg =
                                                p.seat_color && p.character
                                                    ? getCharacterConfig(
                                                          p.character,
                                                          p.seat_color,
                                                      )
                                                    : null;

                                            return (
                                                <li
                                                    key={p.id}
                                                    className="flex items-center justify-between gap-2 py-2"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <div
                                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full p-[1.5px]"
                                                            style={{
                                                                background:
                                                                    seatCfg
                                                                        ? seatCfg
                                                                              .palette
                                                                              .base
                                                                        : '#cbd5e1',
                                                            }}
                                                        >
                                                            {charCfg ? (
                                                                <img
                                                                    src={
                                                                        charCfg.image
                                                                    }
                                                                    alt={
                                                                        charCfg.name
                                                                    }
                                                                    width={32}
                                                                    height={32}
                                                                    className="h-full w-full rounded-full bg-white object-cover"
                                                                />
                                                            ) : (
                                                                <span
                                                                    className="h-full w-full rounded-full border-2 border-white"
                                                                    style={{
                                                                        backgroundColor:
                                                                            seatCfg
                                                                                ? seatCfg
                                                                                      .palette
                                                                                      .base
                                                                                : '#e2e8f0',
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-ink truncate text-xs font-bold">
                                                                {p.name}
                                                                {p.is_host
                                                                    ? ' (Host)'
                                                                    : ''}
                                                            </p>
                                                            <p className="text-ink-muted truncate text-[10px]">
                                                                {p.seat_color
                                                                    ? charCfg
                                                                        ? `${charCfg.name} · ${PLAYER_CONFIG[p.seat_color].label}`
                                                                        : `${PLAYER_CONFIG[p.seat_color].label} · Pilih karakter`
                                                                    : 'Belum pilih warna'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                        {p.is_host && (
                                                            <span
                                                                title="Host"
                                                                className="text-ludo-yellow"
                                                            >
                                                                <TrophyIcon className="h-4 w-4" />
                                                            </span>
                                                        )}
                                                        <span
                                                            className={`grid h-5 w-5 place-items-center rounded-full text-white ${
                                                                p.is_ready
                                                                    ? 'bg-ludo-green'
                                                                    : 'bg-line text-ink-muted'
                                                            }`}
                                                        >
                                                            <CheckIcon className="h-3 w-3" />
                                                        </span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                        {occupiedCount < playerCount && (
                                            <li className="flex items-center justify-between gap-2 py-2">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="border-line bg-canvas h-8 w-8 shrink-0 rounded-full border border-dashed" />
                                                    <span className="text-ink-muted text-xs italic">
                                                        Menunggu pemain…
                                                    </span>
                                                </div>
                                                <span className="text-ink-muted text-xs font-bold tracking-widest">
                                                    •••
                                                </span>
                                            </li>
                                        )}
                                    </ul>

                                    <RoomSettingsSummary
                                        vsComputer={vsComputer}
                                        onSelectOpponent={handleSelectOpponent}
                                        playerCount={playerCount}
                                        isHost={isHost}
                                        pending={pendingAction}
                                        randomizing={randomizing}
                                        onRandomize={handleRandomize}
                                        onSelectPlayerCount={
                                            handleSelectPlayerCount
                                        }
                                    />

                                    <div className="border-line/80 mt-auto flex flex-col gap-2 border-t pt-3.5">
                                        <div className="border-line flex items-center justify-between gap-3 rounded-2xl border px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="text-ink text-xs font-semibold">
                                                    Ready
                                                </p>
                                                <p className="text-ink-muted mt-0.5 text-[11px]">
                                                    {!currentMe?.seat_color
                                                        ? 'Pilih warna home base dulu.'
                                                        : !currentMe.character
                                                          ? 'Pilih karakter dulu untuk siap.'
                                                          : currentMe.is_ready
                                                            ? 'Kamu sudah siap bermain.'
                                                            : 'Aktifkan saat kamu siap bermain.'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-label="Ready"
                                                aria-checked={Boolean(
                                                    currentMe?.is_ready,
                                                )}
                                                aria-busy={pendingAction}
                                                disabled={
                                                    !currentMe?.seat_color ||
                                                    !currentMe?.character ||
                                                    isBusy
                                                }
                                                onClick={handleToggleReady}
                                                className="switch"
                                            >
                                                <span className="w-6 text-right tabular-nums">
                                                    {pendingAction
                                                        ? '…'
                                                        : currentMe?.is_ready
                                                          ? 'ON'
                                                          : 'OFF'}
                                                </span>
                                                <span
                                                    aria-hidden="true"
                                                    className="switch-track"
                                                >
                                                    <span className="switch-thumb" />
                                                </span>
                                            </button>
                                        </div>

                                        <div className="flex min-w-0 items-center gap-2">
                                            {isHost ? (
                                                <button
                                                    type="button"
                                                    disabled={
                                                        !allReady || isBusy
                                                    }
                                                    onClick={handleStartMatch}
                                                    aria-busy={pendingAction}
                                                    className="btn btn-primary min-w-0 flex-1"
                                                >
                                                    <DiceIcon
                                                        className={`h-4 w-4 ${pendingAction ? 'animate-spin' : ''}`}
                                                    />
                                                    {pendingAction
                                                        ? 'Memulai…'
                                                        : 'Start'}
                                                </button>
                                            ) : (
                                                <div className="bg-surface-muted text-ink-muted inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-2.5 text-center text-xs font-semibold">
                                                    <span className="truncate">
                                                        {allReady
                                                            ? 'Semua siap · Menunggu host'
                                                            : 'Menunggu host memulai'}
                                                    </span>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    cue();
                                                    setChatOpen(
                                                        (current) => !current,
                                                    );
                                                }}
                                                aria-label={
                                                    chatOpen
                                                        ? 'Tutup chat'
                                                        : 'Buka chat'
                                                }
                                                aria-expanded={chatOpen}
                                                className="btn btn-secondary relative shrink-0 px-3"
                                            >
                                                <ChatBubbleIcon className="h-4 w-4" />
                                                <span>Chat</span>
                                                {chatUnread > 0 && (
                                                    <span className="game-chat-badge">
                                                        {chatUnread > 99
                                                            ? '99+'
                                                            : chatUnread}
                                                    </span>
                                                )}
                                            </button>
                                        </div>

                                        <p className="text-ink-muted pt-0.5 text-center text-[11px] leading-4">
                                            {startBlockedReason ??
                                                'Semua pemain sudah siap. Host bisa memulai permainan.'}
                                        </p>
                                    </div>
                                </section>
                            </aside>
                        </div>

                        <div className="shadow-card mt-2 min-w-0 shrink-0 rounded-2xl border border-white/85 bg-white/95 p-2 backdrop-blur-md md:hidden">
                            <div className="flex min-w-0 items-center gap-2">
                                <div className="border-line flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border pr-1 pl-3">
                                    <span className="text-ink min-w-0 truncate text-xs font-semibold">
                                        {!currentMe?.seat_color
                                            ? 'Pilih warna'
                                            : !currentMe.character
                                              ? 'Pilih karakter'
                                              : 'Ready'}
                                    </span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-label="Ready"
                                        aria-checked={Boolean(
                                            currentMe?.is_ready,
                                        )}
                                        aria-busy={pendingAction}
                                        disabled={
                                            !currentMe?.seat_color ||
                                            !currentMe?.character ||
                                            isBusy
                                        }
                                        onClick={handleToggleReady}
                                        className="switch"
                                    >
                                        <span className="w-6 text-right tabular-nums">
                                            {pendingAction
                                                ? '…'
                                                : currentMe?.is_ready
                                                  ? 'ON'
                                                  : 'OFF'}
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className="switch-track"
                                        >
                                            <span className="switch-thumb" />
                                        </span>
                                    </button>
                                </div>

                                {isHost ? (
                                    <button
                                        type="button"
                                        disabled={!allReady || isBusy}
                                        onClick={handleStartMatch}
                                        aria-busy={pendingAction}
                                        className="btn btn-primary flex-1 px-3"
                                    >
                                        <DiceIcon
                                            className={`h-4 w-4 ${pendingAction ? 'animate-spin' : ''}`}
                                        />
                                        {pendingAction
                                            ? 'Memulai…'
                                            : 'Start'}
                                    </button>
                                ) : (
                                    <div className="bg-surface-muted text-ink-muted inline-flex h-11 flex-1 items-center justify-center rounded-xl px-2 text-center text-[11px] font-semibold">
                                        {allReady
                                            ? 'Tunggu host'
                                            : 'Menunggu siap'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                )}
            </div>

            <RequiredPlayerNameModal
                open={requiredNameModalOpen}
                roomCode={liveRoom?.code ?? ''}
            />

            <CharacterSelectModal
                open={characterModalOpen}
                seatColor={characterModalSeat}
                initialCharacter={
                    characterModalSeat &&
                    currentMe?.seat_color === characterModalSeat
                        ? currentMe.character
                        : characterModalSeat
                          ? DEFAULT_CHARACTER_BY_COLOR[characterModalSeat]
                          : currentMe?.character
                }
                processing={pendingAction}
                takenCharacters={takenCharacters}
                onClose={() => {
                    if (!pendingAction) {
                        setCharacterModalOpen(false);
                    }
                }}
                onConfirm={handleConfirmCharacter}
            />

            {advancedModalOpen && liveRoom && isHost && (
                <div
                    className="modal-overlay bg-ink/40 backdrop-blur-[3px]"
                    style={advancedOverlayStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="room-advanced-title"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            setAdvancedModalOpen(false);
                        }
                    }}
                >
                    <div className="modal-panel animate-modal-enter border-line max-w-sm overflow-y-auto overscroll-contain rounded-[24px] border bg-white p-5 shadow-[0_24px_64px_-16px_rgba(32,43,58,0.3)]">
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <h2
                                id="room-advanced-title"
                                className="text-ink text-base font-semibold"
                            >
                                Advanced
                            </h2>
                            <button
                                type="button"
                                onClick={() => setAdvancedModalOpen(false)}
                                aria-label="Tutup Advanced"
                                className="btn btn-quiet btn-sm btn-icon"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <RoomSettingsSummary
                                vsComputer={vsComputer}
                                onSelectOpponent={handleSelectOpponent}
                                playerCount={playerCount}
                                isHost={isHost}
                                pending={pendingAction}
                                randomizing={randomizing}
                                onRandomize={handleRandomize}
                                onSelectPlayerCount={handleSelectPlayerCount}
                            />

                            <div className="border-line flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="text-ink text-xs font-semibold">
                                        Keuntungan host
                                    </p>
                                    <p className="text-ink-muted mt-0.5 text-[11px]">
                                        Peluang 50% dadu 6 (keluar markas / di
                                        jalan) atau menangkap saat tersedia.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-label="Keuntungan host"
                                    aria-checked={Boolean(
                                        liveRoom?.host_advantage,
                                    )}
                                    aria-busy={pendingAction}
                                    disabled={!isHost || isBusy}
                                    onClick={handleToggleAdvantage}
                                    className="switch shrink-0"
                                >
                                    <span className="w-6 text-right tabular-nums">
                                        {pendingAction
                                            ? '…'
                                            : liveRoom?.host_advantage
                                              ? 'ON'
                                              : 'OFF'}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="switch-track"
                                    >
                                        <span className="switch-thumb" />
                                    </span>
                                </button>
                            </div>
                        </div>

                        {!isHost && (
                            <p className="text-ink-muted mt-2.5 text-[11px]">
                                Hanya host yang dapat mengubah pengaturan ini.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {hostEditingPlayer && liveRoom && (
                <div
                    className="modal-overlay bg-ink/40 backdrop-blur-[3px]"
                    style={hostRenameOverlayStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="host-rename-player-title"
                    onClick={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            renamingPlayerId === null
                        ) {
                            setHostEditingPlayer(null);
                            setHostNameError(null);
                        }
                    }}
                >
                    <form
                        onSubmit={handleHostSavePlayerName}
                        className="modal-panel animate-modal-enter border-line max-w-sm overflow-y-auto overscroll-contain rounded-[24px] border bg-white p-5 shadow-[0_24px_64px_-16px_rgba(32,43,58,0.3)]"
                    >
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <h2
                                    id="host-rename-player-title"
                                    className="text-ink text-base font-semibold"
                                >
                                    Ganti nama pemain
                                </h2>
                                <p className="text-ink-muted mt-0.5 truncate text-xs">
                                    {hostEditingPlayer.name}
                                    {hostEditingPlayer.seat_color
                                        ? ` · Kursi ${PLAYER_CONFIG[hostEditingPlayer.seat_color].label}`
                                        : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={renamingPlayerId !== null}
                                onClick={() => {
                                    setHostEditingPlayer(null);
                                    setHostNameError(null);
                                }}
                                aria-label="Tutup ganti nama pemain"
                                className="btn btn-quiet btn-sm btn-icon shrink-0"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <label
                            htmlFor="host-player-name-input"
                            className="text-ink block text-xs font-semibold"
                        >
                            Nama baru
                        </label>
                        <input
                            id="host-player-name-input"
                            type="text"
                            autoFocus={!hasCoarsePointer()}
                            value={hostNameDraft}
                            onChange={(event) => {
                                setHostNameDraft(
                                    event.target.value.slice(0, 24),
                                );
                                if (hostNameError) {
                                    setHostNameError(null);
                                }
                            }}
                            maxLength={24}
                            placeholder="Masukkan nama pemain"
                            aria-label="Nama pemain baru"
                            className="border-line bg-canvas text-ink focus:border-brand focus:ring-brand/10 mt-1.5 h-11 w-full rounded-xl border px-3 text-base font-medium focus:bg-white focus:ring-4 focus:outline-none"
                        />

                        {hostNameError && (
                            <p
                                role="alert"
                                className="bg-danger/10 text-danger mt-2.5 rounded-xl px-3 py-2 text-xs font-semibold"
                            >
                                {hostNameError}
                            </p>
                        )}

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                disabled={renamingPlayerId !== null}
                                onClick={() => {
                                    setHostEditingPlayer(null);
                                    setHostNameError(null);
                                }}
                                className="btn btn-secondary flex-1 px-4"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={
                                    !hostNameDraft.trim() ||
                                    renamingPlayerId !== null
                                }
                                aria-busy={renamingPlayerId !== null}
                                className="btn btn-primary flex-1 px-4"
                            >
                                {renamingPlayerId !== null ? (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                                        />
                                        Menyimpan…
                                    </>
                                ) : (
                                    'Simpan'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <CreateRoomPasswordModal
                open={createPasswordOpen}
                passwordRequired={!canCreateRoom}
                processing={pendingAction}
                error={createPasswordError}
                onCancel={() => {
                    if (!pendingAction) {
                        setCreatePasswordOpen(false);
                        setCreatePasswordError(null);
                    }
                }}
                onSubmit={(password, vsComputer) => {
                    cue();
                    postRoomCreation(password || undefined, vsComputer);
                }}
            />

            {viewMode === 'lobby' &&
                liveRoom &&
                currentMe &&
                liveRoom.status === 'waiting' && (
                    <RoomChat
                        code={liveRoom.code}
                        playerId={currentMe.id}
                        open={chatOpen}
                        onOpenChange={setChatOpen}
                        onUnreadChange={setChatUnread}
                        containerClassName="game-chat-room"
                    />
                )}

            <ConfirmLeaveModal
                open={exitGuard.open}
                title="Keluar dari ruang?"
                description={
                    <>
                        Kamu masih duduk di ruang {liveRoom?.code ?? 'ini'}.
                        Ruang tetap aktif, jadi kamu bisa kembali dengan membuka
                        tautan atau memasukkan kode ruang yang sama. Yakin ingin
                        keluar?
                    </>
                }
                cancelLabel="Tetap di ruang"
                confirmLabel="Ya, keluar"
                onCancel={exitGuard.cancel}
                onConfirm={exitGuard.leave}
            />
        </>
    );
}
