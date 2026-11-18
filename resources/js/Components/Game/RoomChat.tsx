import { ChatBubbleIcon } from '@/Components/Game/Icons';
import { PlayerColor } from '@/lib/ludo';
import { useHttp } from '@inertiajs/react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

export type ChatMessage = {
    id: number;
    room_player_id: number;
    name: string;
    seat_color?: PlayerColor | string | null;
    message: string;
};

type RoomChatProps = {
    code: string;
    playerId: number;
    onMessage?: (message: ChatMessage) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onUnreadChange?: (unread: number) => void;
    toggleClassName?: string;
    containerClassName?: string;
};

/**
 * Shared chat state and polling for both chat presentations (floating
 * overlay on small screens, embedded panel on wide screens).
 */
function useRoomChat({
    code,
    playerId,
    onMessage,
    onIncoming,
}: RoomChatProps & {
    onIncoming?: (messages: ChatMessage[]) => void;
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [error, setError] = useState('');
    const cursor = useRef(0);
    const loaded = useRef(false);
    const chat = useHttp<{ message: string }, { message: ChatMessage }>({ message: '' });

    const refresh = useCallback(async () => {
        try {
            const url = new URL(route('rooms.chat.index', { code }), window.location.origin);
            url.searchParams.set('after', String(cursor.current));
            const response = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('chat unavailable');
            const data = await response.json() as { messages: ChatMessage[] };
            const fresh = data.messages.filter((item) => item.id > cursor.current);
            if (fresh.length) {
                cursor.current = fresh[fresh.length - 1].id;
                setMessages((current) => [...current, ...fresh]);
                const others = fresh.filter((item) => item.room_player_id !== playerId);
                if (loaded.current) {
                    others.forEach((item) => onMessage?.(item));
                    onIncoming?.(others);
                }
            }
            loaded.current = true;
            setError('');
        } catch {
            setError('Chat belum terhubung. Mencoba lagi…');
        }
    }, [code, playerId, onMessage, onIncoming]);

    useEffect(() => {
        let active = true;
        let timer: number;
        const poll = async () => {
            await refresh();
            if (active) timer = window.setTimeout(poll, 2000);
        };
        void poll();
        return () => { active = false; window.clearTimeout(timer); };
    }, [refresh]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!chat.data.message.trim() || chat.processing) return;
        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            await chat.post(route('rooms.chat.store', { code }), { headers: { 'X-CSRF-TOKEN': csrf } });
            chat.setData('message', '');
            await refresh();
        } catch {
            setError('Pesan gagal dikirim. Coba lagi.');
        }
    };

    return { messages, error, chat, submit };
}

function ChatMessageList({ messages, playerId }: {
    messages: ChatMessage[];
    playerId: number;
}) {
    return (
        <>
            {messages.length === 0 && <p className="game-chat-empty">Belum ada pesan. Sapa pemain lain!</p>}
            {messages.map((item) => (
                <div key={item.id} className={`game-chat-message ${item.room_player_id === playerId ? 'is-mine' : ''}`}>
                    <strong>{item.room_player_id === playerId ? 'Kamu' : item.name}</strong>
                    <p>{item.message}</p>
                </div>
            ))}
        </>
    );
}

export default function RoomChat({
    code,
    playerId,
    onMessage,
    open: controlledOpen,
    onOpenChange,
    onUnreadChange,
    toggleClassName = '',
    containerClassName = '',
}: RoomChatProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const openRef = useRef(open);
    const listRef = useRef<HTMLDivElement>(null);

    const setOpen = useCallback(
        (next: boolean) => {
            if (!isControlled) {
                setInternalOpen(next);
            }
            onOpenChange?.(next);
            if (next) {
                setUnread(0);
            }
        },
        [isControlled, onOpenChange],
    );

    const onIncoming = useCallback((incoming: ChatMessage[]) => {
        if (!openRef.current) setUnread((count) => count + incoming.length);
    }, []);

    const { messages, error, chat, submit } = useRoomChat({
        code,
        playerId,
        onMessage,
        onIncoming,
    });

    openRef.current = open;

    useEffect(() => {
        if (open) {
            setUnread(0);
            if (listRef.current) {
                listRef.current.scrollTop = listRef.current.scrollHeight;
            }
        }
    }, [messages, open]);

    useEffect(() => {
        onUnreadChange?.(unread);
    }, [unread, onUnreadChange]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, setOpen]);

    return (
        <div className={`game-chat ${containerClassName}`.trim()}>
            {open && (
                <section className="game-chat-panel" aria-label="Chat permainan">
                    <header className="game-chat-header">
                        <div><strong>Chat pemain</strong><p>Ruang {code}</p></div>
                        <button type="button" className="game-chat-close" onClick={() => setOpen(false)} aria-label="Minimalkan chat">−</button>
                    </header>
                    <div ref={listRef} className="game-chat-messages" aria-live="polite">
                        <ChatMessageList messages={messages} playerId={playerId} />
                    </div>
                    {error && <p className="game-chat-error" role="status">{error}</p>}
                    <form className="game-chat-form" onSubmit={submit}>
                        <input aria-label="Tulis pesan" placeholder="Tulis pesan…" maxLength={200} value={chat.data.message} onChange={(event) => chat.setData('message', event.target.value)} />
                        <button type="submit" disabled={chat.processing || !chat.data.message.trim()} aria-busy={chat.processing}>{chat.processing ? '…' : 'Kirim'}</button>
                    </form>
                </section>
            )}
            <button
                type="button"
                className={`game-chat-toggle ${toggleClassName}`.trim()}
                aria-label={open ? 'Minimalkan chat' : 'Buka chat'}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <ChatBubbleIcon />
                {unread > 0 && <span className="game-chat-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
        </div>
    );
}

/**
 * Always-open chat card for the desktop side panel. Fills the remaining
 * height of its flex parent instead of floating above the board.
 */
export function RoomChatPanel({ code, playerId, onMessage }: RoomChatProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const { messages, error, chat, submit } = useRoomChat({ code, playerId, onMessage });

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages]);

    return (
        <section
            className="shadow-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-white/85 bg-white/95 backdrop-blur-md"
            aria-label="Chat permainan"
        >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line/60 px-4 pb-2 pt-3.5">
                <h2 className="text-brand-ink text-[10px] font-extrabold tracking-[0.14em]">CHAT PEMAIN</h2>
                <p className="text-ink-muted text-[10px] font-semibold tabular-nums">Ruang {code}</p>
            </div>
            <div ref={listRef} className="game-chat-messages" aria-live="polite">
                <ChatMessageList messages={messages} playerId={playerId} />
            </div>
            {error && <p className="game-chat-error" role="status">{error}</p>}
            <form className="game-chat-form" onSubmit={submit}>
                <input aria-label="Tulis pesan" placeholder="Tulis pesan…" maxLength={200} value={chat.data.message} onChange={(event) => chat.setData('message', event.target.value)} />
                <button type="submit" disabled={chat.processing || !chat.data.message.trim()} aria-busy={chat.processing}>{chat.processing ? '…' : 'Kirim'}</button>
            </form>
        </section>
    );
}
