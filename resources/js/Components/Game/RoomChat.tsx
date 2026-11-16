import { PlayerColor } from '@/lib/ludo';
import { useHttp } from '@inertiajs/react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type ChatMessage = {
    id: number;
    room_player_id: number;
    name: string;
    seat_color: PlayerColor;
    message: string;
};

export default function RoomChat({ code, playerId, onMessage }: {
    code: string;
    playerId: number;
    onMessage: (message: ChatMessage) => void;
}) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unread, setUnread] = useState(0);
    const [error, setError] = useState('');
    const cursor = useRef(0);
    const loaded = useRef(false);
    const openRef = useRef(open);
    const listRef = useRef<HTMLDivElement>(null);
    const chat = useHttp<{ message: string }, { message: ChatMessage }>({ message: '' });
    openRef.current = open;

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
                    others.forEach(onMessage);
                    if (!openRef.current) setUnread((count) => count + others.length);
                }
            }
            loaded.current = true;
            setError('');
        } catch {
            setError('Chat belum terhubung. Mencoba lagi…');
        }
    }, [code, playerId, onMessage]);

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

    useEffect(() => {
        if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages, open]);

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

    return (
        <div className="game-chat">
            {open && (
                <section className="game-chat-panel" aria-label="Chat permainan">
                    <header className="game-chat-header">
                        <div><strong>Chat pemain</strong><p>Ruang {code}</p></div>
                        <button type="button" className="game-chat-close" onClick={() => setOpen(false)} aria-label="Minimalkan chat">−</button>
                    </header>
                    <div ref={listRef} className="game-chat-messages" aria-live="polite">
                        {messages.length === 0 && <p className="game-chat-empty">Belum ada pesan. Sapa pemain lain!</p>}
                        {messages.map((item) => (
                            <div key={item.id} className={`game-chat-message ${item.room_player_id === playerId ? 'is-mine' : ''}`}>
                                <strong>{item.room_player_id === playerId ? 'Kamu' : item.name}</strong>
                                <p>{item.message}</p>
                            </div>
                        ))}
                    </div>
                    {error && <p className="game-chat-error" role="status">{error}</p>}
                    <form className="game-chat-form" onSubmit={submit}>
                        <input aria-label="Tulis pesan" placeholder="Tulis pesan…" maxLength={200} value={chat.data.message} onChange={(event) => chat.setData('message', event.target.value)} />
                        <button type="submit" disabled={chat.processing || !chat.data.message.trim()} aria-busy={chat.processing}>{chat.processing ? '…' : 'Kirim'}</button>
                    </form>
                </section>
            )}
            <button type="button" className="game-chat-toggle" aria-label={open ? 'Minimalkan chat' : 'Buka chat'} aria-expanded={open} onClick={() => { setOpen(!open); setUnread(0); }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.5-.8L4 20l1.3-4A7.5 7.5 0 1 1 20 11.5Z" /></svg>
                {unread > 0 && <span className="game-chat-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
        </div>
    );
}
